// Re-export Prisma types as the source of truth
export type {
  ProjectStatus,
  AgentType,
  AgentStatus,
  TaskStatus,
  UserRole,
  TeamRole,
  ProjectRole,
  DebugSessionStatus,
} from "@/generated/prisma";

// ── Chat / Message Types (for frontend) ──

export type MessageRole = "user" | "assistant" | "system";

export type MessageType =
  | "text"
  | "plan"
  | "tool_call"
  | "tool_result"
  | "error"
  | "status";

export interface ChatMessage {
  id: string;
  projectId: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  agentId?: string;
  agentType?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── Project (frontend-friendly shape) ──

export interface ProjectView {
  id: string;
  name: string;
  status: string;
  idea: string;
  plan: unknown;
  sourceRepoUrl: string | null;
  gitRepoUrl: string | null;
  gitBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Agent Event (for WebSocket) ──

export interface AgentEventView {
  agentId: string;
  agentType: string;
  projectId: string;
  type: string;
  content?: string;
  toolName?: string;
  timestamp: string;
}

// ── WebSocket Event Types ──

export interface WsClientEvent {
  type: "subscribe" | "message" | "approve" | "cancel";
  projectId: string;
  content?: string;
}

export interface WsServerEvent {
  type: "stream" | "status" | "plan" | "error" | "done" | "chat_history" | "agent_event";
  projectId: string;
  content?: string;
  status?: string;
  messages?: ChatMessage[];
  event?: AgentEventView;
  sourceRepoUrl?: string;
}

// ── API Request/Response Types ──

export interface CreateProjectRequest {
  idea: string;
  name?: string;
  templateId?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ── File Explorer Types ──

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

// ── Legacy alias for frontend components ──

export type Project = ProjectView;
