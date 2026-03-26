import { NextRequest, NextResponse } from "next/server";
import {
  restoreSnapshot,
  deleteVersion,
} from "@/lib/versioning/version-manager";
import type { ApiResponse } from "@/types";

/** POST /api/versions/[id]/restore — roll back to this version and restart */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    restoreSnapshot(id);
    // Signal the process to restart (server.ts watches for this)
    setTimeout(() => {
      console.log(`[version] Restored to ${id}, restarting...`);
      process.exit(0); // Process manager (Docker/PM2/tsx --watch) will restart
    }, 500);
    return NextResponse.json({
      ok: true,
      data: { restored: id, message: "Server restarting with restored version..." },
    } satisfies ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/** DELETE /api/versions/[id] — delete a snapshot */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    deleteVersion(id);
    return NextResponse.json({ ok: true } satisfies ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
