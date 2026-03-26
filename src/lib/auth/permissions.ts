import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import type { ProjectRole } from "@/generated/prisma";

/** Get the current authenticated user or null */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
