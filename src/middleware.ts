import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const publicPaths = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/versions",
];

function isPublic(pathname: string): boolean {
  return publicPaths.some((p) => pathname.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie (JWT strategy — no DB needed in edge)
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `${BASE}/login`;
    loginUrl.searchParams.set("callbackUrl", `${BASE}${pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
