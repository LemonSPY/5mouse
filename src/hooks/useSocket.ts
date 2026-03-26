"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { WsClientEvent, WsServerEvent, ChatMessage } from "@/types";

export function useSocket(projectId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string>("IDLE");
  const [streamContent, setStreamContent] = useState("");

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const socket = io({
      path: `${basePath}/ws`,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("event", (data: WsServerEvent) => {
      if (projectId && data.projectId !== projectId) return;

      switch (data.type) {
        case "chat_history":
          if (data.messages) setMessages(data.messages);
          if (data.status) setStatus(data.status);
          break;

        case "stream":
          if (data.event?.type === "message" && data.event.content) {
            setStreamContent((prev) => prev + data.event!.content);
          }
          break;

        case "agent_event":
          // Handle agent-specific events
          if (data.event?.type === "message" && data.event.content) {
            setStreamContent((prev) => prev + data.event!.content);
          }
          break;

        case "status":
          if (data.status) {
            setStatus(data.status);
            // When status moves to a "settled" state, flush stream to messages
            if (
              ["PLAN_REVIEW", "REVIEW", "DONE", "ERROR"].includes(data.status)
            ) {
              setStreamContent((prev) => {
                if (prev.trim()) {
                  setMessages((msgs) => [
                    ...msgs,
                    {
                      id: `stream-${Date.now()}`,
                      projectId: data.projectId,
                      role: "assistant",
                      type: data.status === "PLAN_REVIEW" ? "plan" : "text",
                      content: prev,
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                }
                return "";
              });
            }
          }
          break;

        case "error":
          if (data.content) {
            setMessages((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                projectId: data.projectId,
                role: "system",
                type: "error",
                content: data.content!,
                createdAt: new Date().toISOString(),
              },
            ]);
          }
          break;
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  // Subscribe to project when projectId changes
  useEffect(() => {
    if (projectId && socketRef.current?.connected) {
      setMessages([]);
      setStreamContent("");
      const evt: WsClientEvent = { type: "subscribe", projectId };
      socketRef.current.emit("event", evt);
    }
  }, [projectId, connected]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!projectId || !socketRef.current) return;

      // Optimistically add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          projectId,
          role: "user",
          type: "text",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);

      const evt: WsClientEvent = { type: "message", projectId, content };
      socketRef.current.emit("event", evt);
    },
    [projectId]
  );

  const approvePlan = useCallback(() => {
    if (!projectId || !socketRef.current) return;
    const evt: WsClientEvent = { type: "approve", projectId };
    socketRef.current.emit("event", evt);
  }, [projectId]);

  const cancelBuild = useCallback(() => {
    if (!projectId || !socketRef.current) return;
    const evt: WsClientEvent = { type: "cancel", projectId };
    socketRef.current.emit("event", evt);
  }, [projectId]);

  return {
    connected,
    messages,
    status,
    streamContent,
    sendMessage,
    approvePlan,
    cancelBuild,
  };
}
