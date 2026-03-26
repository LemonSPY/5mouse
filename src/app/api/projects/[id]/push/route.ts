import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { pushToGitHub } from "@/lib/workflow/workflow-engine";
import type { ApiResponse } from "@/types";

export async function POST(
  _req: NextRequest,
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

  try {
    const url = await pushToGitHub(id);
    return NextResponse.json({ ok: true, data: { url } } satisfies ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
