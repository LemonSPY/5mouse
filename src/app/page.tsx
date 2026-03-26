"use client";

import { useState, useEffect, useRef } from "react";
import { ProjectList } from "@/components/sidebar/ProjectList";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { PlanReview } from "@/components/chat/PlanReview";
import { BuildProgress } from "@/components/chat/BuildProgress";
import { FileExplorer } from "@/components/chat/FileExplorer";
import { useSocket } from "@/hooks/useSocket";
import type { Project } from "@/types";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    connected,
    messages,
    status,
    streamContent,
    sendMessage,
    approvePlan,
    cancelBuild,
  } = useSocket(selectedId);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (data.ok) setProjects(data.data);
  };

  const handleNewProject = async () => {
    const idea = prompt("Describe your software idea:");
    if (!idea) return;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    const data = await res.json();
    if (data.ok) {
      setProjects((prev) => [data.data, ...prev]);
      setSelectedId(data.data.id);
      setTimeout(() => sendMessage(idea), 500);
    }
  };

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleApprove = () => {
    approvePlan();
  };

  const handleReject = () => {
    sendMessage("Let's start over with a different approach.");
  };

  const handleImportProject = async () => {
    const repoUrl = prompt("Enter GitHub repo URL (e.g. https://github.com/owner/repo):");
    if (!repoUrl) return;

    const res = await fetch("/api/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    });
    const data = await res.json();
    if (data.ok) {
      setProjects((prev) => [data.data, ...prev]);
      setSelectedId(data.data.id);
    } else {
      alert(data.error || "Import failed");
    }
  };

  const isActive = ["PLANNING", "BUILDING", "MODIFYING", "ANALYZING"].includes(status);

  const getPlaceholder = () => {
    if (!selectedId) return "Create a new project to get started...";
    if (status === "IDLE") return "Describe your software idea...";
    if (status === "ANALYZING") return "Analyzing the imported codebase...";
    if (status === "PLAN_REVIEW") return "Edit the plan, or approve to build...";
    if (status === "REVIEW" || status === "DONE") return "Request changes or new features...";
    if (isActive) return "Waiting for Claude...";
    return "Type a message...";
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0">
        <ProjectList
          projects={projects}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setShowFiles(false);
          }}
          onNew={handleNewProject}
          onImport={handleImportProject}
        />
      </div>

      {/* Main Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {selectedId ? (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-zinc-400">
                  {projects.find((p) => p.id === selectedId)?.name || "Project"}
                </span>
                <span className="text-xs text-zinc-600">{status.toLowerCase().replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFiles(!showFiles)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    showFiles
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Files
                </button>
                {(status === "REVIEW" || status === "DONE") && (
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `/api/projects/${selectedId}/push`,
                        { method: "POST" }
                      );
                      const data = await res.json();
                      if (data.ok) {
                        window.open(data.data.url, "_blank");
                      } else {
                        alert(data.error || "Push failed");
                      }
                    }}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Push to GitHub
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Chat area */}
              <div className="flex flex-1 flex-col min-w-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    {messages.length === 0 && !streamContent && (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-4">🐭</div>
                          <h2 className="text-xl font-semibold text-zinc-300 mb-2">
                            Ready to build
                          </h2>
                          <p className="text-sm text-zinc-500">
                            Describe your software idea and 5mouse will plan and
                            build it for you.
                          </p>
                        </div>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <ChatMessage key={msg.id} message={msg} />
                    ))}
                    {streamContent && (
                      <div className="mb-4 rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-100 max-w-[80%]">
                        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                          {streamContent}
                        </div>
                        <div className="h-1 w-3 bg-zinc-500 animate-pulse mt-2 rounded" />
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Build progress bar */}
                <BuildProgress
                  status={status}
                  streamContent={streamContent}
                  onCancel={cancelBuild}
                />

                {/* Plan review buttons */}
                {status === "PLAN_REVIEW" && (
                  <PlanReview onApprove={handleApprove} onReject={handleReject} />
                )}

                {/* Input */}
                <ChatInput
                  onSend={handleSend}
                  disabled={isActive}
                  placeholder={getPlaceholder()}
                />
              </div>

              {/* File explorer panel */}
              {showFiles && (
                <div className="w-[500px] flex-shrink-0">
                  <FileExplorer projectId={selectedId} />
                </div>
              )}
            </div>
          </>
        ) : (
          /* No project selected */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-6">🐭</div>
              <h1 className="text-3xl font-bold text-zinc-200 mb-3">5mouse</h1>
              <p className="text-zinc-500 mb-6 max-w-md">
                AI-powered software builder. Describe an idea, get a plan,
                approve it, and watch it get built — all from this chat.
              </p>
              <button
                onClick={handleNewProject}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                + New Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
