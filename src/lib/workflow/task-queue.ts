import { Queue, Worker, Job } from "bullmq";
import type { AgentType } from "@/generated/prisma";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Parse Redis URL into connection options for BullMQ
function getConnectionOpts() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
  };
}

// ── Job Data Types ──────────────────────────────────────────────

export interface PlanJobData {
  type: "plan";
  projectId: string;
  userId: string;
}

export interface BuildJobData {
  type: "build";
  projectId: string;
  userId: string;
}

export interface ModifyJobData {
  type: "modify";
  projectId: string;
  userId: string;
  instruction: string;
}

export interface AgentJobData {
  type: "agent";
  projectId: string;
  agentType: AgentType;
  taskTitle: string;
  taskDescription: string;
  prompt: string;
  files?: string[];
  priority?: number;
}

export type JobData = PlanJobData | BuildJobData | ModifyJobData | AgentJobData;

// ── Queues ──────────────────────────────────────────────────────

const QUEUE_NAME = "agent-tasks";

let _queue: Queue | null = null;

export function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: getConnectionOpts(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1, // AI tasks shouldn't auto-retry — they need context
      },
    });
  }
  return _queue;
}

// ── Job Submission ──────────────────────────────────────────────

export async function submitPlanJob(projectId: string, userId: string): Promise<Job> {
  const queue = getQueue();
  return queue.add("plan", { type: "plan", projectId, userId }, { priority: 1 });
}

export async function submitBuildJob(projectId: string, userId: string): Promise<Job> {
  const queue = getQueue();
  return queue.add("build", { type: "build", projectId, userId }, { priority: 2 });
}

export async function submitModifyJob(
  projectId: string,
  userId: string,
  instruction: string
): Promise<Job> {
  const queue = getQueue();
  return queue.add("modify", { type: "modify", projectId, userId, instruction }, { priority: 3 });
}

export async function submitAgentJob(data: AgentJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add("agent", data, { priority: data.priority || 5 });
}

// ── Worker Setup (call from server.ts) ──────────────────────────

export function createWorker(
  processor: (job: Job) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAME, processor, {
    connection: getConnectionOpts(),
    concurrency: 5, // Up to 5 agents running simultaneously
  });
}

// ── Cleanup ─────────────────────────────────────────────────────

export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
