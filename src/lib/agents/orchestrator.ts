import { EventEmitter } from "events";
import { prisma } from "@/lib/db/client";
import { AgentRunner } from "./agent-runner";
import type { AgentEvent, AgentResult, AgentTask } from "./types";
import type { AgentType, AgentStatus } from "@/generated/prisma";

interface RunningAgent {
  runner: AgentRunner;
  task: AgentTask;
}

/**
 * Orchestrates multiple AI agents working on a project in parallel.
 * Manages agent lifecycle, task assignment, and inter-agent communication.
 */
export class AgentOrchestrator extends EventEmitter {
  private projectId: string;
  private runningAgents = new Map<string, RunningAgent>();
  private fileLocks = new Map<string, string>(); // filePath → agentId
  private envOverrides: Record<string, string>;

  constructor(projectId: string, envOverrides?: Record<string, string>) {
    super();
    this.projectId = projectId;
    this.envOverrides = envOverrides || {};
  }

  /** Spawn an agent to work on a task */
  async spawnAgent(
    agentType: AgentType,
    task: AgentTask,
    cwd: string,
    prompt: string
  ): Promise<AgentResult> {
    // Create agent record in DB
    const agent = await prisma.agent.create({
      data: {
        type: agentType,
        status: "RUNNING",
        projectId: this.projectId,
      },
    });

    // Create DB task record
    const dbTask = await prisma.task.create({
      data: {
        projectId: this.projectId,
        title: task.title,
        description: task.description,
        status: "IN_PROGRESS",
        assignedAgentId: agent.id,
        priority: task.priority,
        dependsOn: task.dependencies || [],
      },
    });

    // Update agent with current task
    await prisma.agent.update({
      where: { id: agent.id },
      data: { currentTaskId: dbTask.id },
    });

    // Acquire file locks
    if (task.files) {
      for (const file of task.files) {
        if (this.fileLocks.has(file)) {
          throw new Error(
            `File ${file} is locked by agent ${this.fileLocks.get(file)}`
          );
        }
        this.fileLocks.set(file, agent.id);
      }
    }

    const runner = new AgentRunner(agent.id, agentType, this.projectId, this.envOverrides);
    this.runningAgents.set(agent.id, { runner, task });

    // Forward agent events
    runner.on("agent_event", (event: AgentEvent) => {
      this.emit("agent_event", event);
    });

    try {
      const result = await runner.run(prompt, cwd, task);

      // Update DB records
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: result.status as AgentStatus,
          completedAt: new Date(),
        },
      });

      await prisma.task.update({
        where: { id: dbTask.id },
        data: {
          status: result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
          completedAt: new Date(),
        },
      });

      return result;
    } catch (err) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { status: "ERROR", completedAt: new Date() },
      });
      await prisma.task.update({
        where: { id: dbTask.id },
        data: { status: "FAILED" },
      });
      throw err;
    } finally {
      // Release file locks
      if (task.files) {
        for (const file of task.files) {
          if (this.fileLocks.get(file) === agent.id) {
            this.fileLocks.delete(file);
          }
        }
      }
      this.runningAgents.delete(agent.id);
    }
  }

  /** Run multiple agents in parallel */
  async runParallel(
    agents: Array<{
      type: AgentType;
      task: AgentTask;
      prompt: string;
    }>,
    cwd: string
  ): Promise<AgentResult[]> {
    const promises = agents.map((a) =>
      this.spawnAgent(a.type, a.task, cwd, a.prompt)
    );
    return Promise.allSettled(promises).then((results) =>
      results.map((r) => {
        if (r.status === "fulfilled") return r.value;
        return {
          agentId: "unknown",
          agentType: "CODER" as AgentType,
          status: "ERROR" as AgentStatus,
          filesModified: [],
          summary: "",
          errors: [String(r.reason)],
        };
      })
    );
  }

  /** Cancel a specific agent */
  cancelAgent(agentId: string): boolean {
    const running = this.runningAgents.get(agentId);
    if (!running) return false;
    running.runner.cancel();
    return true;
  }

  /** Cancel all running agents */
  cancelAll(): void {
    for (const [, { runner }] of this.runningAgents) {
      runner.cancel();
    }
  }

  /** Get status of all running agents */
  getRunningAgents(): Array<{ agentId: string; type: AgentType; task: string }> {
    const result: Array<{ agentId: string; type: AgentType; task: string }> = [];
    for (const [agentId, { runner, task }] of this.runningAgents) {
      // Access agentType from task context
      result.push({ agentId, type: "CODER", task: task.title });
    }
    return result;
  }

  /** Check if any agents are still running */
  get isActive(): boolean {
    return this.runningAgents.size > 0;
  }
}
