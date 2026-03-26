import { NextResponse } from "next/server";
import {
  listVersions,
  createSnapshot,
  getActiveVersion,
} from "@/lib/versioning/version-manager";
import type { ApiResponse } from "@/types";

/** GET /api/versions — list all saved versions */
export async function GET() {
  try {
    const versions = listVersions();
    const active = getActiveVersion();
    return NextResponse.json({
      ok: true,
      data: { versions, activeVersion: active },
    } satisfies ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/** POST /api/versions — create a manual snapshot */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const label = body.label || `Manual snapshot ${new Date().toLocaleString()}`;
    const entry = createSnapshot(label, "manual");
    return NextResponse.json({ ok: true, data: entry } satisfies ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
