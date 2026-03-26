import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/auth";
import type { ApiResponse } from "@/types";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true } satisfies ApiResponse);
}
