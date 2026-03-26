"use client";

import type { Project } from "@/types";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const statusColors: Record<string, string> = {
  IDLE: "bg-zinc-600",
  PLANNING: "bg-yellow-500 animate-pulse",
  PLAN_REVIEW: "bg-yellow-400",
  BUILDING: "bg-blue-500 animate-pulse",
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
  REVIEW: "Review",
  MODIFYING: "Modifying...",
  DEBUGGING: "Debugging...",
  DONE: "Done",
  ERROR: "Error",
};

export function ProjectList({ projects, selectedId, onSelect, onNew }: ProjectListProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-zinc-100">5mouse</h1>
          <button
            onClick={onNew}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            + New
          </button>
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
    </div>
  );
}
