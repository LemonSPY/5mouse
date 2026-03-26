import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";

const COOKIE_NAME = "app-session";
const DEFAULT_USER_NAME = "Admin";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is required");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
}

/** Create a signed JWT and set it as an httpOnly cookie. */
export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return token;
}

/** Read and verify the session cookie. Returns { userId } or null. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

/** Clear the session cookie. */
export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Get or create the default user. In single-user mode we always use one user
 * record to link settings and projects to.
 */
export async function getOrCreateDefaultUser() {
  // Look for existing user first
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  // Create default user
  return prisma.user.create({
    data: { name: DEFAULT_USER_NAME, role: "ADMIN" },
  });
}
