import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface ClaudeStreamEvent {
  type: "message" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface OrchestratorOptions {
  cwd: string;
  tools?: string[];
  maxTurns?: number;
}

/**
 * Spawns `claude -p` as a child process, streams JSON output,
 * and emits typed events for each message/tool_call/error/done.
 */
export class ClaudeOrchestrator extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";

  /** Run a prompt through Claude CLI and stream events back. */
  async run(prompt: string, opts: OrchestratorOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["-p", "--output-format", "stream-json"];

      if (opts.tools?.length) {
        args.push("--allowedTools", opts.tools.join(","));
      }

      this.process = spawn("claude", args, {
        cwd: opts.cwd,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Write prompt to stdin and close it
      this.process.stdin?.write(prompt);
      this.process.stdin?.end();

      this.process.stdout?.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      this.process.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          const evt: ClaudeStreamEvent = { type: "error", content: text };
          this.emit("event", evt);
        }
      });

      this.process.on("close", (code) => {
        // Flush remaining buffer
        this.processBuffer();
        const evt: ClaudeStreamEvent = { type: "done", content: `exit ${code}` };
        this.emit("event", evt);
        this.process = null;
        if (code === 0) resolve();
        else reject(new Error(`Claude CLI exited with code ${code}`));
      });

      this.process.on("error", (err) => {
        const evt: ClaudeStreamEvent = { type: "error", content: err.message };
        this.emit("event", evt);
        this.process = null;
        reject(err);
      });
    });
  }

  /** Cancel the running subprocess. */
  cancel(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  /** Parse newline-delimited JSON from the buffer. */
  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const evt = this.toStreamEvent(parsed);
        if (evt) this.emit("event", evt);
      } catch {
        const evt: ClaudeStreamEvent = { type: "message", content: trimmed };
        this.emit("event", evt);
      }
    }
  }

  /** Normalize raw JSON from Claude CLI into our event type. */
  private toStreamEvent(raw: Record<string, unknown>): ClaudeStreamEvent | null {
    if (raw.type === "assistant" || raw.type === "text" || raw.role === "assistant") {
      return {
        type: "message",
        content:
          typeof raw.content === "string"
            ? raw.content
            : JSON.stringify(raw.content),
      };
    }
    if (raw.type === "tool_use" || raw.type === "tool_call") {
      return {
        type: "tool_call",
        toolName: (raw.name ?? raw.tool_name) as string,
        toolInput: (raw.input ?? raw.tool_input) as Record<string, unknown>,
      };
    }
    if (raw.type === "tool_result") {
      return {
        type: "tool_result",
        content:
          typeof raw.content === "string"
            ? raw.content
            : JSON.stringify(raw.content),
      };
    }
    return {
      type: "message",
      content: JSON.stringify(raw),
    };
  }
}
