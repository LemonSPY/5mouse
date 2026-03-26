import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/auth";
import { GitManager } from "@/lib/git/git-manager";
import type { ApiResponse } from "@/types";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const body = await req.json();
  const { repoUrl, name, branch } = body as {
    repoUrl: string;
    name?: string;
    branch?: string;
  };

  if (!repoUrl || typeof repoUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "repoUrl is required" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // Normalize: strip trailing slash and .git suffix for validation
  const normalizedUrl = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
  if (!GITHUB_URL_PATTERN.test(normalizedUrl + "/")) {
    return NextResponse.json(
      { ok: false, error: "Invalid GitHub repository URL. Expected format: https://github.com/{owner}/{repo}" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // Derive a project name from the repo URL if not provided
  const repoName = normalizedUrl.split("/").pop() || "imported-project";
  const projectName = name?.trim() || repoName;

  const project = await prisma.project.create({
    data: {
      name: projectName,
      idea: `Imported from ${normalizedUrl}`,
      sourceRepoUrl: normalizedUrl,
      gitRepoUrl: normalizedUrl,
      gitBranch: branch || "main",
      createdById: session.userId,
      members: {
        create: { userId: session.userId, role: "OWNER" },
      },
    },
  });

  // Clone the repo into the project directory
  const projectDir = path.join(PROJECTS_DIR, project.id);
  try {
    const git = new GitManager();
    await git.clone(normalizedUrl, projectDir, branch || "main");
  } catch (err) {
    // Clean up DB record on clone failure
    await prisma.project.delete({ where: { id: project.id } });
    return NextResponse.json(
      { ok: false, error: `Failed to clone repository: ${err instanceof Error ? err.message : String(err)}` } satisfies ApiResponse,
      { status: 422 }
    );
  }

  return NextResponse.json(
    { ok: true, data: project } satisfies ApiResponse,
    { status: 201 }
  );
}
