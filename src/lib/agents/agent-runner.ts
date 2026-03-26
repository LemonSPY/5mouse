import { ClaudeOrchestrator } from "./claude-orchestrator";
import { AGENT_CONFIGS } from "./types";
import type { AgentEvent, AgentResult, AgentConfig, AgentTask } from "./types";
import type { AgentType } from "@/generated/prisma";
import { EventEmitter } from "events";

/**
 * Runs a single AI agent by spawning a Claude CLI process
 * with the agent's specific system prompt and tool permissions.
 */
export class AgentRunner extends EventEmitter {
  private orchestrator: ClaudeOrchestrator;
  private config: AgentConfig;
  private agentId: string;
  private projectId: string;
  private filesModified: string[] = [];
  private cancelled = false;
  private envOverrides: Record<string, string>;

  constructor(agentId: string, agentType: AgentType, projectId: string, envOverrides?: Record<string, string>) {
    super();
    this.agentId = agentId;
    this.projectId = projectId;
    this.config = AGENT_CONFIGS[agentType];
    this.orchestrator = new ClaudeOrchestrator();
    this.envOverrides = envOverrides || {};
  }

  /** Execute the agent with a specific prompt in a working directory */
  async run(prompt: string, cwd: string, task?: AgentTask): Promise<AgentResult> {
    const fullPrompt = this.buildPrompt(prompt, task);
    let resultText = "";

    this.emitEvent("started", `${this.config.name} agent started`);

    this.orchestrator.on("event", (evt) => {
      switch (evt.type) {
        case "message":
          if (evt.content) resultText += evt.content;
          this.emitEvent("message", evt.content);
          break;
        case "tool_call":
          this.emitEvent("tool_call", undefined, evt.toolName, evt.toolInput);
          // Track file modifications
          if (evt.toolName === "Write" || evt.toolName === "Edit" || evt.toolName === "MultiEdit") {
            const filePath = (evt.toolInput?.file_path || evt.toolInput?.path) as string;
            if (filePath && !this.filesModified.includes(filePath)) {
              this.filesModified.push(filePath);
              this.emitEvent("file_modified", filePath);
            }
          }
          break;
        case "tool_result":
          this.emitEvent("tool_result", evt.content);
          break;
        case "error":
          this.emitEvent("error", evt.content);
          break;
      }
    });

    try {
      await this.orchestrator.run(fullPrompt, {
        cwd,
        tools: this.config.tools,
        maxTurns: this.config.maxTurns,
        envOverrides: this.envOverrides,
      });

      this.emitEvent("completed", `${this.config.name} agent completed`);

      return {
        agentId: this.agentId,
        agentType: this.config.type,
        status: this.cancelled ? "CANCELLED" : "COMPLETED",
        filesModified: this.filesModified,
        summary: resultText,
      };
    } catch (err) {
      const errorMsg = String(err);
      this.emitEvent("error", errorMsg);

      return {
        agentId: this.agentId,
        agentType: this.config.type,
        status: "ERROR",
        filesModified: this.filesModified,
        summary: resultText,
        errors: [errorMsg],
      };
    }
  }

  /** Cancel the running agent */
  cancel(): void {
    this.cancelled = true;
    this.orchestrator.cancel();
    this.emitEvent("completed", `${this.config.name} agent cancelled`);
  }

  private buildPrompt(userPrompt: string, task?: AgentTask): string {
    let prompt = this.config.systemPrompt + "\n\n";

    if (task) {
      prompt += `## Your Assignment\n`;
      prompt += `**Task:** ${task.title}\n`;
      prompt += `**Description:** ${task.description}\n`;
      if (task.files?.length) {
        prompt += `**Files to work on:** ${task.files.join(", ")}\n`;
      }
      prompt += "\n";
    }

    prompt += `## Context\n${userPrompt}`;
    return prompt;
  }

  private emitEvent(
    type: AgentEvent["type"],
    content?: string,
    toolName?: string,
    toolInput?: Record<string, unknown>
  ): void {
    const event: AgentEvent = {
      agentId: this.agentId,
      agentType: this.config.type,
      projectId: this.projectId,
      type,
      content,
      toolName,
      toolInput,
      timestamp: new Date().toISOString(),
    };
    this.emit("agent_event", event);
  }
}
