"use client";

import { useState, useEffect } from "react";
import type { FileNode } from "@/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface FileExplorerProps {
  projectId: string;
}

export function FileExplorer({ projectId }: FileExplorerProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/projects/${projectId}/files`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) setTree(data.data);
      })
      .catch(() => {});
  }, [projectId]);

  const loadFile = async (filePath: string) => {
    setLoading(true);
    setSelectedFile(filePath);
    try {
      const res = await fetch(
        `${BASE}/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`
      );
      const data = res.ok ? await res.json() : null;
      if (data?.ok) setFileContent(data.data.content);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="flex h-full border-l border-zinc-800">
      {/* Tree */}
      <div className="w-60 overflow-y-auto bg-zinc-950 p-2 text-xs">
        <div className="text-zinc-500 uppercase tracking-wider mb-2 px-2 text-[10px] font-semibold">
          Files
        </div>
        {tree.length === 0 ? (
          <div className="text-zinc-600 px-2">No files yet</div>
        ) : (
          <TreeNodes nodes={tree} depth={0} onSelect={loadFile} selected={selectedFile} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4">
        {selectedFile ? (
          <>
            <div className="text-xs text-zinc-500 mb-2 font-mono">{selectedFile}</div>
            {loading ? (
              <div className="text-zinc-600 text-sm">Loading...</div>
            ) : (
              <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                {fileContent}
              </pre>
            )}
          </>
        ) : (
          <div className="text-zinc-600 text-sm">Select a file to view</div>
        )}
      </div>
    </div>
  );
}

function TreeNodes({
  nodes,
  depth,
  onSelect,
  selected,
}: {
  nodes: FileNode[];
  depth: number;
  onSelect: (path: string) => void;
  selected: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <button
            onClick={() => {
              if (node.type === "directory") {
                setExpanded((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
              } else {
                onSelect(node.path);
              }
            }}
            className={`w-full text-left px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors ${
              selected === node.path ? "bg-zinc-800 text-blue-400" : "text-zinc-400"
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span className="mr-1">
              {node.type === "directory"
                ? expanded[node.path]
                  ? "▾"
                  : "▸"
                : ""}
            </span>
            {node.name}
          </button>
          {node.type === "directory" && expanded[node.path] && node.children && (
            <TreeNodes
              nodes={node.children}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          )}
        </div>
      ))}
    </>
  );
}
