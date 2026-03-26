import type { ProjectStatus } from "@/generated/prisma";

/**
 * Valid state transitions for projects.
 * Uses the Prisma enum ProjectStatus values.
 */
const transitions: Record<ProjectStatus, ProjectStatus[]> = {
  IDLE: ["PLANNING"],
  PLANNING: ["PLAN_REVIEW", "ERROR"],
  PLAN_REVIEW: ["BUILDING", "PLANNING", "IDLE"],
  BUILDING: ["REVIEW", "ERROR"],
  REVIEW: ["MODIFYING", "DEBUGGING", "DONE"],
  MODIFYING: ["REVIEW", "ERROR"],
  DEBUGGING: ["REVIEW", "ERROR"],
  DONE: ["MODIFYING", "DEBUGGING"],
  ERROR: ["IDLE", "PLANNING"],
};

/** Check whether a transition from `from` to `to` is valid. */
export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

/** Attempt a state transition; throws if invalid. */
export function transition(from: ProjectStatus, to: ProjectStatus): ProjectStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} → ${to}`);
  }
  return to;
}

/** Return the list of allowed next states from the current state. */
export function allowedTransitions(from: ProjectStatus): ProjectStatus[] {
  return transitions[from] ?? [];
}
