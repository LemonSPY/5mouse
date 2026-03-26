import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/auth";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";
import type { ApiResponse } from "@/types";

/** GET /api/settings — return the current user's settings (keys masked). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    ok: true,
    data: {
      hasAnthropicKey: !!settings?.anthropicApiKey,
      anthropicKeyHint: settings?.anthropicApiKey
        ? maskKey(decrypt(settings.anthropicApiKey))
        : null,
      hasGithubToken: !!settings?.githubToken,
      githubTokenHint: settings?.githubToken
        ? maskKey(decrypt(settings.githubToken))
        : null,
    },
  } satisfies ApiResponse);
}

/** PUT /api/settings — update the current user's API keys. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const body = await req.json();
  const { anthropicApiKey, githubToken } = body as {
    anthropicApiKey?: string | null;
    githubToken?: string | null;
  };

  // Build update payload — only update fields that were sent
  const data: Record<string, string | null> = {};
  if (anthropicApiKey !== undefined) {
    data.anthropicApiKey = anthropicApiKey ? encrypt(anthropicApiKey) : null;
  }
  if (githubToken !== undefined) {
    data.githubToken = githubToken ? encrypt(githubToken) : null;
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true } satisfies ApiResponse);
}
