/** Task workflow (backend: models/task.model.js), in Kanban column order. */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'CODE_REVIEW' | 'TESTING' | 'DONE' | 'BLOCKED';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'CODE_REVIEW',
  'TESTING',
  'DONE',
  'BLOCKED',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  CODE_REVIEW: 'Code review',
  TESTING: 'Testing',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

/** Allowed status changes — same table as the backend (TASK_TRANSITIONS). */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['TODO', 'CODE_REVIEW', 'BLOCKED'],
  CODE_REVIEW: ['IN_PROGRESS', 'TESTING', 'BLOCKED'],
  TESTING: ['IN_PROGRESS', 'CODE_REVIEW', 'DONE', 'BLOCKED'],
  DONE: ['IN_PROGRESS'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING'],
};

/** Statuses in which somebody must be working on the task (an assignee is required). */
export const STATUSES_REQUIRING_ASSIGNEE: readonly TaskStatus[] = [
  'IN_PROGRESS',
  'CODE_REVIEW',
  'TESTING',
  'DONE',
];

export type TaskType =
  'FEATURE' | 'BUG' | 'IMPROVEMENT' | 'TESTING' | 'DOCUMENTATION' | 'DEVOPS' | 'SECURITY';

export const TASK_TYPES: readonly TaskType[] = [
  'FEATURE',
  'BUG',
  'IMPROVEMENT',
  'TESTING',
  'DOCUMENTATION',
  'DEVOPS',
  'SECURITY',
];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  FEATURE: 'Feature',
  BUG: 'Bug',
  IMPROVEMENT: 'Improvement',
  TESTING: 'Testing',
  DOCUMENTATION: 'Documentation',
  DEVOPS: 'DevOps',
  SECURITY: 'Security',
};

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const TASK_PRIORITIES: readonly TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/** Complexity in story points (Fibonacci scale); 8 and more = high complexity. */
export const STORY_POINTS: readonly number[] = [1, 2, 3, 5, 8, 13];

export const TASK_LIMITS = {
  titleMaxLength: 200,
  descriptionMaxLength: 5000,
  maxRequiredSkills: 20,
  skillMaxLength: 50,
  blockedReasonMaxLength: 500,
} as const;

/** Public fields of a user referenced by a task (assignee, creator). */
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  complexity: number;
  status: TaskStatus;
  deadline?: string;
  /** Deadline passed and status ≠ DONE (computed by the backend). */
  isOverdue: boolean;
  requiredSkills: string[];
  project: string;
  /** null = backlog. */
  sprint: string | null;
  /** null = unassigned. */
  assignee: UserSummary | null;
  createdBy: UserSummary;
  /** Only while BLOCKED. */
  blockedReason?: string;
  /** Only once DONE. */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Task of GET /tasks/assigned: project and sprint are populated. */
export interface AssignedTask extends Omit<Task, 'project' | 'sprint'> {
  project: { id: string; name: string; status: string };
  sprint: { id: string; name: string; status: string } | null;
}

/** Task of the Kanban board (the creator is not populated there). */
export type BoardTask = Omit<Task, 'createdBy'>;

/** GET /projects/:id/board: one column per status, tasks by priority then creation date. */
export interface Board {
  project: { id: string; name: string; status: string };
  sprint: { id: string; name: string; status: string } | null;
  /** SPRINT (one sprint), BACKLOG (tasks without sprint) or ALL. */
  scope: 'SPRINT' | 'BACKLOG' | 'ALL';
  totalTasks: number;
  columns: { status: TaskStatus; count: number; tasks: BoardTask[] }[];
}

/** Editable fields (POST /projects/:id/tasks, PATCH /tasks/:id). */
export interface TaskInput {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  complexity: number;
  /** `YYYY-MM-DD`; null removes it. */
  deadline: string | null;
  requiredSkills: string[];
  /** Sprint id, or null for the backlog. */
  sprint: string | null;
}
