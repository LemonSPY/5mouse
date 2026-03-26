import { NextRequest, NextResponse } from "next/server";
import { createSession, getOrCreateDefaultUser } from "@/lib/auth/auth";
import { timingSafeEqual } from "crypto";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD not configured on server" } satisfies ApiResponse,
      { status: 500 }
    );
  }

  if (
    !password ||
    password.length !== expected.length ||
    !timingSafeEqual(Buffer.from(password), Buffer.from(expected))
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" } satisfies ApiResponse,
      { status: 401 }
    );
  }

  const user = await getOrCreateDefaultUser();
  await createSession(user.id);

  return NextResponse.json({ ok: true } satisfies ApiResponse);
}
