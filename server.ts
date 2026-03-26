import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import {
  runPlanning,
  runBuild,
  runModify,
  runAnalysis,
  cancelJob,
} from "./src/lib/workflow/workflow-engine";
import { prisma } from "./src/lib/db/client";
import { messageBus } from "./src/lib/agents/message-bus";
import type { AgentEvent } from "./src/lib/agents/types";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "4000", 10);
const basePath = process.env.BASE_PATH || "";

const app = next({ dev });
const handle = app.getRequestHandler();

// Map old status strings to new enum values
function normalizeStatus(status: string): string {
  return status.toUpperCase().replace(/ /g, "_");
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Strip basePath prefix so Next.js handles routing correctly
    if (basePath && req.url?.startsWith(basePath)) {
      req.url = req.url.slice(basePath.length) || "/";
    }
    handle(req, res);
  });

  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: basePath ? `${basePath}/ws` : "/ws",
  });

  // Forward agent events to Socket.IO rooms
  messageBus.on("event", (event: AgentEvent) => {
    io.to(event.projectId).emit("event", {
      type: "agent_event",
      projectId: event.projectId,
      event,
    });
  });

  io.on("connection", (socket) => {
    console.log(`[ws] client connected: ${socket.id}`);

    socket.on("event", async (data: { type: string; projectId: string; content?: string }) => {
      const { type, projectId, content } = data;

      const send = (evt: Record<string, unknown>) => {
        socket.emit("event", { projectId, ...evt });
      };

      try {
        switch (type) {
          case "subscribe": {
            socket.join(projectId);
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            const messages = await prisma.message.findMany({
              where: { projectId },
              orderBy: { createdAt: "asc" },
            });

            // Map messages to the format frontend expects
            const mappedMessages = messages.map((m: any) => ({
              id: m.id,
              projectId: m.projectId,
              role: m.role,
              type: m.type,
              content: m.content,
              metadata: m.metadata,
              createdAt: m.createdAt.toISOString(),
            }));

            send({
              type: "chat_history",
              messages: mappedMessages,
              status: project?.status,
            });

            // Auto-trigger analysis for imported projects that are still IDLE
            if (project?.status === "IDLE" && project.sourceRepoUrl) {
              runAnalysis(
                projectId,
                (evt) => send({ type: "stream", event: evt }),
                (status) => send({ type: "status", status }),
                project.createdById
              );
            }
            break;
          }

          case "message": {
            if (!content) break;
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (!project) {
              send({ type: "error", content: "Project not found" });
              break;
            }

            // Save user message to DB
            await prisma.message.create({
              data: { projectId, role: "user", type: "text", content },
            });

            if (project.status === "IDLE") {
              // Imported projects get analysis, new projects get planning
              if (project.sourceRepoUrl) {
                runAnalysis(
                  projectId,
                  (evt) => send({ type: "stream", event: evt }),
                  (status) => send({ type: "status", status }),
                  project.createdById
                );
              } else {
                runPlanning(
                  projectId,
                  (evt) => send({ type: "stream", event: evt }),
                  (status) => send({ type: "status", status }),
                  project.createdById
                );
              }
            } else if (project.status === "REVIEW" || project.status === "DONE") {
              runModify(
                projectId,
                content,
                (evt) => send({ type: "stream", event: evt }),
                (status) => send({ type: "status", status }),
                project.createdById
              );
            }
            break;
          }

          case "approve": {
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (!project || project.status !== "PLAN_REVIEW") {
              send({ type: "error", content: "No plan to approve" });
              break;
            }
            runBuild(
              projectId,
              (evt) => send({ type: "stream", event: evt }),
              (status) => send({ type: "status", status }),
              project.createdById
            );
            break;
          }

          case "cancel": {
            const cancelled = cancelJob(projectId);
            send({
              type: "status",
              status: "ERROR",
              content: cancelled ? "Build cancelled" : "No active build to cancel",
            });
            break;
          }
        }
      } catch (err) {
        send({ type: "error", content: String(err) });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[ws] client disconnected: ${socket.id}`);
    });
  });

  server.listen(port, () => {
    console.log(`> Platform running on http://localhost:${port}`);
  });
});
