import { EventEmitter } from "events";
import type { AgentEvent } from "./types";

/**
 * Central message bus for agent events.
 * Routes events between agents, the orchestrator, and the UI (via Socket.IO).
 */
class AgentMessageBus extends EventEmitter {
  /** Publish an event from an agent */
  publish(event: AgentEvent): void {
    // Emit to project-specific listeners
    this.emit(`project:${event.projectId}`, event);
    // Emit to agent-specific listeners
    this.emit(`agent:${event.agentId}`, event);
    // Emit to global listeners
    this.emit("event", event);
  }

  /** Subscribe to all events for a project */
  onProject(projectId: string, handler: (event: AgentEvent) => void): () => void {
    const key = `project:${projectId}`;
    this.on(key, handler);
    return () => this.off(key, handler);
  }

  /** Subscribe to events from a specific agent */
  onAgent(agentId: string, handler: (event: AgentEvent) => void): () => void {
    const key = `agent:${agentId}`;
    this.on(key, handler);
    return () => this.off(key, handler);
  }
}

// Singleton instance
export const messageBus = new AgentMessageBus();
