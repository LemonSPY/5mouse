import { AgentOrchestrator, messageBus } from "@/lib/agents";
import { GitManager } from "@/lib/git/git-manager";
import { prisma } from "@/lib/db/client";
import { decrypt } from "@/lib/crypto";
import { createSnapshot } from "@/lib/versioning/version-manager";
import { transition } from "./state-machine";
import type { AgentEvent, AgentTask } from "@/lib/agents/types";
import type { ProjectStatus } from "@/generated/prisma";
import path from "path";
import fs from "fs";

type EventCallback = (evt: AgentEvent) => void;
type StatusCallback = (status: ProjectStatus) => void;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

/** Look up the user's API keys and return env overrides for agent subprocesses. */
async function getUserEnvOverrides(userId: string): Promise<Record<string, string>> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const overrides: Record<string, string> = {};
  if (settings?.anthropicApiKey) {
    overrides.ANTHROPIC_API_KEY = decrypt(settings.anthropicApiKey);
  }
  if (settings?.githubToken) {
    overrides.GITHUB_TOKEN = decrypt(settings.githubToken);
  }
  return overrides;
}

/** Active orchestrators keyed by project ID — used for cancellation. */
const activeOrchestrators = new Map<string, AgentOrchestrator>();

/** Get or create the project working directory */
export function getProjectDir(projectId: string): string {
  const dir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Run the analysis phase: Analyzer agent examines an imported codebase.
 */
export async function runAnalysis(
  projectId: string,
  onEvent: EventCallback,
  onStatus: StatusCallback,
  userId?: string
): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const newStatus = transition(project.status, "ANALYZING");
  await prisma.project.update({ where: { id: projectId }, data: { status: newStatus } });
  onStatus(newStatus);

  const envOverrides = userId ? await getUserEnvOverrides(userId) : {};
  const orchestrator = new AgentOrchestrator(projectId, envOverrides);
  activeOrchestrators.set(projectId, orchestrator);

  orchestrator.on("agent_event", (evt: AgentEvent) => {
    onEvent(evt);
    messageBus.publish(evt);
  });

  const cwd = getProjectDir(projectId);

  const task: AgentTask = {
    id: `analyze-${projectId}`,
    title: "Analyze imported codebase",
    description: `Analyze the existing codebase imported from ${project.sourceRepoUrl || "unknown source"}. Produce a comprehensive project profile.`,
    priority: 10,
  };

  try {
    const result = await orchestrator.spawnAgent(
      "ANALYZER",
      task,
      cwd,
      `This is an imported project from ${project.sourceRepoUrl}. Analyze the entire codebase and produce a comprehensive project profile covering tech stack, architecture, database schema, key components, API routes, dependencies, configuration, entry points, code quality, and areas of concern.`
    );

    // Save analysis as the project plan
    await prisma.project.update({
      where: { id: projectId },
      data: { plan: result.summary, status: "REVIEW" },
    });

    await prisma.message.create({
      data: { projectId, role: "assistant", type: "plan", content: result.summary },
    });

    onStatus("REVIEW");
  } catch (err) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
    onStatus("ERROR");
    await prisma.message.create({
      data: { projectId, role: "system", type: "error", content: String(err) },
    });
  } finally {
    activeOrchestrators.delete(projectId);
  }
}

/**
 * Run the planning phase: Planner agent interviews user and creates a plan.
 */
export async function runPlanning(
  projectId: string,
  onEvent: EventCallback,
  onStatus: StatusCallback,
  userId?: string
): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const newStatus = transition(project.status, "PLANNING");
  await prisma.project.update({ where: { id: projectId }, data: { status: newStatus } });
  onStatus(newStatus);

  const envOverrides = userId ? await getUserEnvOverrides(userId) : {};
  const orchestrator = new AgentOrchestrator(projectId, envOverrides);
  activeOrchestrators.set(projectId, orchestrator);

  // Forward events
  orchestrator.on("agent_event", (evt: AgentEvent) => {
    onEvent(evt);
    messageBus.publish(evt);
  });

  const task: AgentTask = {
    id: `plan-${projectId}`,
    title: "Create project plan",
    description: `Create a detailed implementation plan for: ${project.idea}`,
    priority: 10,
  };

  try {
    await prisma.message.create({
      data: { projectId, role: "user", type: "text", content: project.idea },
    });

    const result = await orchestrator.spawnAgent(
      "PLANNER",
      task,
      getProjectDir(projectId),
      project.idea
    );

    // Save the plan
    await prisma.project.update({
      where: { id: projectId },
      data: { plan: result.summary, status: "PLAN_REVIEW" },
    });

    await prisma.message.create({
      data: { projectId, role: "assistant", type: "plan", content: result.summary },
    });

    onStatus("PLAN_REVIEW");
  } catch (err) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
    onStatus("ERROR");
    await prisma.message.create({
      data: { projectId, role: "system", type: "error", content: String(err) },
    });
  } finally {
    activeOrchestrators.delete(projectId);
  }
}

/**
 * Run the build phase: multiple agents work in parallel.
 * Architect scaffolds → Coders implement → Tester verifies
 */
export async function runBuild(
  projectId: string,
  onEvent: EventCallback,
  onStatus: StatusCallback,
  userId?: string
): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!project.plan) throw new Error("No plan found");

  const newStatus = transition(project.status, "BUILDING");
  await prisma.project.update({ where: { id: projectId }, data: { status: newStatus } });
  onStatus(newStatus);

  const envOverrides = userId ? await getUserEnvOverrides(userId) : {};
  const orchestrator = new AgentOrchestrator(projectId, envOverrides);
  activeOrchestrators.set(projectId, orchestrator);

  orchestrator.on("agent_event", (evt: AgentEvent) => {
    onEvent(evt);
    messageBus.publish(evt);
  });

  const cwd = getProjectDir(projectId);
  const planText = typeof project.plan === "string" ? project.plan : JSON.stringify(project.plan);

  try {
    // Phase 1: Architect sets up structure
    const architectTask: AgentTask = {
      id: `arch-${projectId}`,
      title: "Design architecture",
      description: `Set up the project structure based on the approved plan`,
      priority: 10,
    };

    await orchestrator.spawnAgent("ARCHITECT", architectTask, cwd, planText);

    // Phase 2: Coders implement (single coder for now, parallel in future)
    const coderTask: AgentTask = {
      id: `code-${projectId}`,
      title: "Implement code",
      description: `Implement the complete codebase based on the architecture`,
      priority: 8,
    };

    await orchestrator.spawnAgent("CODER", coderTask, cwd, planText);

    // Phase 3: Tester writes tests
    const testerTask: AgentTask = {
      id: `test-${projectId}`,
      title: "Write tests",
      description: `Write tests for the implemented code`,
      priority: 6,
    };

    await orchestrator.spawnAgent("TESTER", testerTask, cwd, planText);

    // Git commit
    const git = new GitManager();
    await git.init(cwd);
    await git.commit(cwd, "Initial build by AI Platform");

    await prisma.message.create({
      data: {
        projectId,
        role: "assistant",
        type: "text",
        content: "Build complete! All files have been generated and tested.",
      },
    });

    const reviewStatus = transition("BUILDING", "REVIEW");
    await prisma.project.update({ where: { id: projectId }, data: { status: reviewStatus } });
    onStatus(reviewStatus);
  } catch (err) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
    onStatus("ERROR");
    await prisma.message.create({
      data: { projectId, role: "system", type: "error", content: String(err) },
    });
  } finally {
    activeOrchestrators.delete(projectId);
  }
}

/**
 * Run a modification: Coder agent applies changes.
 */
export async function runModify(
  projectId: string,
  instruction: string,
  onEvent: EventCallback,
  onStatus: StatusCallback,
  userId?: string
): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const newStatus = transition(project.status, "MODIFYING");
  await prisma.project.update({ where: { id: projectId }, data: { status: newStatus } });
  onStatus(newStatus);

  await prisma.message.create({
    data: { projectId, role: "user", type: "text", content: instruction },
  });

  const envOverrides = userId ? await getUserEnvOverrides(userId) : {};
  const orchestrator = new AgentOrchestrator(projectId, envOverrides);
  activeOrchestrators.set(projectId, orchestrator);

  orchestrator.on("agent_event", (evt: AgentEvent) => {
    onEvent(evt);
    messageBus.publish(evt);
  });

  const cwd = getProjectDir(projectId);
  const context = typeof project.plan === "string"
    ? project.plan
    : project.plan
      ? JSON.stringify(project.plan)
      : project.idea;

  const task: AgentTask = {
    id: `mod-${projectId}-${Date.now()}`,
    title: `Modify: ${instruction.slice(0, 60)}`,
    description: instruction,
    priority: 8,
  };

  try {
    const result = await orchestrator.spawnAgent(
      "CODER",
      task,
      cwd,
      `Project context:\n${context}\n\nUser request:\n${instruction}`
    );

    // Commit changes
    const git = new GitManager();
    await git.commit(cwd, `Modify: ${instruction.slice(0, 72)}`);

    await prisma.message.create({
      data: {
        projectId,
        role: "assistant",
        type: "text",
        content: result.summary || "Modification complete.",
      },
    });

    const reviewStatus = transition("MODIFYING", "REVIEW");
    await prisma.project.update({ where: { id: projectId }, data: { status: reviewStatus } });
    onStatus(reviewStatus);
  } catch (err) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
    onStatus("ERROR");
    await prisma.message.create({
      data: { projectId, role: "system", type: "error", content: String(err) },
    });
  } finally {
    activeOrchestrators.delete(projectId);
  }
}

/**
 * Push the project to GitHub.
 * Automatically creates a version snapshot before pushing.
 */
export async function pushToGitHub(projectId: string, userId?: string): Promise<string> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  // Snapshot before push
  try {
    createSnapshot(`Push: ${project.name}`, "push");
  } catch (e) {
    console.warn("[version] Snapshot failed, continuing push:", e);
  }

  // Use the user's GitHub token if available
  let ghToken: string | undefined;
  const uid = userId || project.createdById;
  if (uid) {
    const overrides = await getUserEnvOverrides(uid);
    if (overrides.GITHUB_TOKEN) ghToken = overrides.GITHUB_TOKEN;
  }

  const git = new GitManager(ghToken);

  if (project.gitRepoUrl) {
    await git.push(getProjectDir(projectId));
    return project.gitRepoUrl;
  }

  const url = await git.createAndPush(
    getProjectDir(projectId),
    project.name,
    true
  );

  await prisma.project.update({
    where: { id: projectId },
    data: { gitRepoUrl: url },
  });

  return url;
}

/**
 * Cancel active jobs for a project.
 */
export function cancelJob(projectId: string): boolean {
  const orchestrator = activeOrchestrators.get(projectId);
  if (!orchestrator) return false;
  orchestrator.cancelAll();
  activeOrchestrators.delete(projectId);
  return true;
}
