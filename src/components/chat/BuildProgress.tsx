"use client";

interface BuildProgressProps {
  status: string;
  streamContent: string;
  onCancel: () => void;
}

export function BuildProgress({ status, streamContent, onCancel }: BuildProgressProps) {
  const isActive = ["PLANNING", "BUILDING", "MODIFYING", "ANALYZING"].includes(status);

  if (!isActive && !streamContent) return null;

  const labels: Record<string, string> = {
    PLANNING: "Generating plan...",
    BUILDING: "Building project...",
    MODIFYING: "Applying changes...",
    ANALYZING: "Analyzing codebase...",
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isActive && (
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
            <span className="text-sm text-zinc-400">
              {labels[status] || "Processing..."}
            </span>
          </div>
          {isActive && (
            <button
              onClick={onCancel}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        {streamContent && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400 font-mono whitespace-pre-wrap">
            {streamContent.slice(-2000)}
          </div>
        )}
      </div>
    </div>
  );
}
