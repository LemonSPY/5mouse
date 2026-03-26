"use client";

import Link from "next/link";
import type { Project } from "@/types";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
}

const statusColors: Record<string, string> = {
  IDLE: "bg-zinc-600",
  PLANNING: "bg-yellow-500 animate-pulse",
  PLAN_REVIEW: "bg-yellow-400",
  BUILDING: "bg-blue-500 animate-pulse",
  ANALYZING: "bg-cyan-500 animate-pulse",
  REVIEW: "bg-blue-400",
  MODIFYING: "bg-purple-500 animate-pulse",
  DEBUGGING: "bg-orange-500 animate-pulse",
  DONE: "bg-green-500",
  ERROR: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  IDLE: "New",
  PLANNING: "Planning...",
  PLAN_REVIEW: "Review Plan",
  BUILDING: "Building...",
  ANALYZING: "Analyzing...",
  REVIEW: "Review",
  MODIFYING: "Modifying...",
  DEBUGGING: "Debugging...",
  DONE: "Done",
  ERROR: "Error",
};

export function ProjectList({ projects, selectedId, onSelect, onNew, onImport }: ProjectListProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-zinc-100">5mouse</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onImport}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Import
            </button>
            <button
              onClick={onNew}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              + New
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">AI Software Builder</p>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="text-zinc-600 text-xs p-2">
            No projects yet. Click &quot;+ New&quot; to start.
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className={`w-full text-left rounded-lg p-3 mb-1 transition-colors ${
                selectedId === project.id
                  ? "bg-zinc-800 ring-1 ring-zinc-700"
                  : "hover:bg-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${statusColors[project.status]}`} />
                <span className="text-sm text-zinc-200 truncate flex-1">
                  {project.name}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-zinc-500">
                  {statusLabels[project.status]}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-zinc-800">
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings &amp; API Keys
        </Link>
      </div>
    </div>
  );
}
