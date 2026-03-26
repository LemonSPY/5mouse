import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/auth";
import { GitManager } from "@/lib/git/git-manager";
import type { ApiResponse } from "@/types";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

interface ImportRequest {
  repoUrl: string;
  name?: string;
  branch?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const body = (await req.json()) as ImportRequest;

  // Validate repoUrl
  const repoUrl = body.repoUrl?.trim();
  if (!repoUrl || !GITHUB_URL_RE.test(repoUrl.replace(/\.git$/, ""))) {
    return NextResponse.json(
      { ok: false, error: "Invalid GitHub URL. Expected https://github.com/{owner}/{repo}" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  // Extract repo name from URL for default project name
  const urlParts = repoUrl.replace(/\.git$/, "").split("/");
  const repoName = urlParts[urlParts.length - 1];
  const projectName = body.name?.trim() || repoName;
  const branch = body.branch?.trim() || undefined;

  // Create project record
  const project = await prisma.project.create({
    data: {
      name: projectName,
      idea: `Imported from ${repoUrl}`,
      sourceRepoUrl: repoUrl,
      gitRepoUrl: repoUrl,
      gitBranch: branch || "main",
      createdById: session.user.id,
      members: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
  });

  // Clone the repo into the project directory
  const projectDir = path.join(PROJECTS_DIR, project.id);

  try {
    const git = new GitManager();
    await git.clone(repoUrl, projectDir, branch);
  } catch (err) {
    // Clean up on clone failure
    await prisma.project.delete({ where: { id: project.id } });
    const message = String(err);
    if (message.includes("Authentication") || message.includes("403") || message.includes("404")) {
      return NextResponse.json(
        { ok: false, error: "Could not clone repository. It may be private — set GITHUB_TOKEN to access private repos." } satisfies ApiResponse,
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: `Clone failed: ${message}` } satisfies ApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, data: project } satisfies ApiResponse,
    { status: 201 }
  );
}
