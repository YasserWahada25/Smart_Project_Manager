import { TaskStatus } from './task';

/** Sprint lifecycle (backend: models/sprint.model.js). */
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** PLANNED → ACTIVE → COMPLETED, PLANNED/ACTIVE → CANCELLED; COMPLETED and CANCELLED are final. */
export const SPRINT_TRANSITIONS: Record<SprintStatus, readonly SprintStatus[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const SPRINT_LIMITS = { nameMaxLength: 100, objectiveMaxLength: 1000 } as const;

/** Computed by the backend from the sprint's tasks (complexity = story points). */
export interface SprintStats {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  totalPoints: number;
  completedPoints: number;
  /** completedPoints / totalPoints, in %, rounded (0 for an empty sprint). */
  progress: number;
  tasksByStatus: Record<TaskStatus, number>;
}

export interface Sprint {
  id: string;
  name: string;
  objective: string;
  project: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Present in GET /sprints/:id and GET /projects/:id/sprints. */
  stats?: SprintStats;
}

export interface SprintInput {
  name: string;
  objective: string;
  startDate: string;
  endDate: string;
}

/** Open sprints (PLANNED, ACTIVE) can receive tasks and be modified. */
export function isSprintOpen(sprint: Pick<Sprint, 'status'>): boolean {
  return sprint.status === 'PLANNED' || sprint.status === 'ACTIVE';
}
