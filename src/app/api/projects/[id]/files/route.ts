import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getProjectDir } from "@/lib/workflow/workflow-engine";
import type { ApiResponse, FileNode } from "@/types";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json(
      { ok: false, error: "Project not found" } satisfies ApiResponse,
      { status: 404 }
    );
  }

  const projectDir = getProjectDir(id);
  const filePath = req.nextUrl.searchParams.get("path");

  // If a specific file path is requested, return its content
  if (filePath) {
    const resolved = path.resolve(projectDir, filePath);
    // Prevent directory traversal
    if (!resolved.startsWith(projectDir)) {
      return NextResponse.json(
        { ok: false, error: "Invalid path" } satisfies ApiResponse,
        { status: 400 }
      );
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return NextResponse.json(
        { ok: false, error: "File not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }
    const content = fs.readFileSync(resolved, "utf-8");
    return NextResponse.json({ ok: true, data: { path: filePath, content } } satisfies ApiResponse);
  }

  // Otherwise return the file tree
  const tree = buildFileTree(projectDir, "");
  return NextResponse.json({ ok: true, data: tree } satisfies ApiResponse<FileNode[]>);
}

function buildFileTree(base: string, rel: string): FileNode[] {
  const full = path.join(base, rel);
  if (!fs.existsSync(full)) return [];

  const entries = fs.readdirSync(full, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip .git and node_modules
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const entryRel = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryRel,
        type: "directory",
        children: buildFileTree(base, entryRel),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryRel,
        type: "file",
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
