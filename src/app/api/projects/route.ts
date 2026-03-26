import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/auth";
import type { CreateProjectRequest, ApiResponse } from "@/types";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

export async function GET() {
  const session = await getSession();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    ...(session?.userId
      ? { where: { createdById: session.userId } }
      : {}),
  });

  return NextResponse.json({ ok: true, data: projects } satisfies ApiResponse);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const body = (await req.json()) as CreateProjectRequest;

  if (!body.idea || typeof body.idea !== "string" || body.idea.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "idea is required" } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name: body.name?.trim() || `project-${Date.now().toString(36)}`,
      idea: body.idea.trim(),
      createdById: session.userId,
      templateId: body.templateId || undefined,
      members: {
        create: { userId: session.userId, role: "OWNER" },
      },
    },
  });

  // Create project directory
  const projectDir = path.join(PROJECTS_DIR, project.id);
  fs.mkdirSync(projectDir, { recursive: true });

  return NextResponse.json(
    { ok: true, data: project } satisfies ApiResponse,
    { status: 201 }
  );
}
