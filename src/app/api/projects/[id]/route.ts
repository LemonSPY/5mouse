import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { ApiResponse } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      agents: { where: { status: { in: ["RUNNING", "PAUSED"] } } },
    },
  });

  if (!project) {
    return NextResponse.json(
      { ok: false, error: "Project not found" } satisfies ApiResponse,
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: project,
  } satisfies ApiResponse);
}
