import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB not reachable
  }

  return NextResponse.json({
    ok: true,
    status: "healthy",
    service: "5mouse",
    db: dbOk,
    env: {
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasGithubId: !!process.env.AUTH_GITHUB_ID,
      hasGithubSecret: !!process.env.AUTH_GITHUB_SECRET,
      hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
      hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
      hasAuthUrl: !!process.env.AUTH_URL,
      authUrl: process.env.AUTH_URL || null,
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || null,
    },
  });
}
