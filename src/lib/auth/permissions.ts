import { getSession } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import type { ProjectRole } from "@/generated/prisma";

/** Get the current authenticated user or null */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

/** Check if user has access to a project with the given minimum role */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  minRole: ProjectRole = "VIEWER"
): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) return false;

  const roleHierarchy: Record<ProjectRole, number> = {
    VIEWER: 0,
    COLLABORATOR: 1,
    OWNER: 2,
  };

  return roleHierarchy[member.role] >= roleHierarchy[minRole];
}

/** Require authentication — throws if not authenticated */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return { id: session.userId };
}
