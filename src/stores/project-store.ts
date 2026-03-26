import { create } from "zustand";
import type { ProjectView, ChatMessage } from "@/types";

interface ProjectState {
  // Data
  projects: ProjectView[];
  selectedId: string | null;
  messages: ChatMessage[];
  status: string;
  streamContent: string;
  connected: boolean;
  showFiles: boolean;

  // Active agents
  activeAgents: Array<{
    agentId: string;
    agentType: string;
    status: string;
    currentTask?: string;
  }>;

  // Actions
  setProjects: (projects: ProjectView[]) => void;
  addProject: (project: ProjectView) => void;
  selectProject: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setStatus: (status: string) => void;
  setStreamContent: (content: string) => void;
  appendStreamContent: (content: string) => void;
  setConnected: (connected: boolean) => void;
  toggleFiles: () => void;
  setShowFiles: (show: boolean) => void;

  // Agent actions
  setActiveAgents: (agents: ProjectState["activeAgents"]) => void;
  updateAgent: (agentId: string, update: Partial<ProjectState["activeAgents"][0]>) => void;

  // Derived
  flushStream: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  selectedId: null,
  messages: [],
  status: "IDLE",
  streamContent: "",
  connected: false,
  showFiles: false,
  activeAgents: [],

  // Actions
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  selectProject: (id) =>
    set({ selectedId: id, messages: [], streamContent: "", status: "IDLE", showFiles: false, activeAgents: [] }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setStatus: (status) => set({ status }),

  setStreamContent: (content) => set({ streamContent: content }),
  appendStreamContent: (content) =>
    set((state) => ({ streamContent: state.streamContent + content })),

  setConnected: (connected) => set({ connected }),

  toggleFiles: () => set((state) => ({ showFiles: !state.showFiles })),
  setShowFiles: (show) => set({ showFiles: show }),

  // Agent actions
  setActiveAgents: (agents) => set({ activeAgents: agents }),
  updateAgent: (agentId, update) =>
    set((state) => ({
      activeAgents: state.activeAgents.map((a) =>
        a.agentId === agentId ? { ...a, ...update } : a
      ),
    })),

  // Flush accumulated stream content to a message
  flushStream: () => {
    const { streamContent, selectedId, status } = get();
    if (!streamContent.trim() || !selectedId) return;

    const message: ChatMessage = {
      id: `stream-${Date.now()}`,
      projectId: selectedId,
      role: "assistant",
      type: status === "PLAN_REVIEW" ? "plan" : "text",
      content: streamContent,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, message],
      streamContent: "",
    }));
  },
}));
