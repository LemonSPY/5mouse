import { handlers } from "@/lib/auth/auth";
import { NextRequest } from "next/server";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Patch the request URL to add the proxy prefix so auth.js can correctly
 * parse the action from the pathname. The reverse proxy strips /5mouse
 * but auth.js basePath is set to /5mouse/api/auth for correct external
 * callback URLs. This re-adds the prefix for internal processing.
 */
function patchUrl(req: NextRequest): NextRequest {
  if (!BASE) return req;
  const url = req.nextUrl.clone();
  url.pathname = `${BASE}${url.pathname}`;
  return new NextRequest(url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    duplex: "half",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

export async function GET(req: NextRequest) {
  return handlers.GET(patchUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(patchUrl(req));
}
