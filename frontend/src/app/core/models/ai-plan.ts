import { TaskPriority, TaskType } from './task';

/**
 * AI-01 — planning from the specification (docs/api.md, "AI planning").
 * Limits shared with the backend (validators/aiPlan.validator.js, middleware/upload.js).
 */
export const PLAN_LIMITS = {
  textMinLength: 20,
  textMaxLength: 200_000,
  maxFileBytes: 5 * 1024 * 1024,
  extensions: ['.txt', '.md', '.pdf', '.docx'],
  maxSprints: 20,
  maxTasks: 100,
  sprintLengthDays: { min: 5, max: 30, default: 14 },
  capacityPerSprint: { min: 3, max: 200, default: 20 },
} as const;

/** Analyzer that produced the plan: OpenAI, or the local rules + Naive Bayes classifier. */
export type PlanMethod = 'llm' | 'local';

/** Task proposed by the AI (not stored yet). */
export interface PlanTask {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  /** Story points (1, 2, 3, 5, 8, 13). */
  complexity: number;
  requiredSkills: string[];
  /** Section of the specification the task comes from (groups the review only, not stored). */
  epic: string;
}

export interface PlanSprint {
  name: string;
  objective: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  tasks: PlanTask[];
}

/** POST /projects/:id/ai/plan → `{ plan }`. Nothing is created before the manager applies it. */
export interface AiPlan {
  method: PlanMethod;
  model: string;
  warnings: string[];
  sprints: PlanSprint[];
  /** Tasks left out of the sprints ("Won't have", over capacity…). */
  backlog: PlanTask[];
  stats: { taskCount: number; sprintCount: number; totalPoints: number; epics: string[] };
  options: { startDate: string; sprintLengthDays: number; capacityPerSprint: number };
  source: { filename: string | null; characters: number };
}

/** Input of the proposal: pasted text and/or one file, plus the planning options. */
export interface PlanRequest {
  text: string;
  file: File | null;
  /** `YYYY-MM-DD`; empty = chosen by the backend (today, or after the last sprint). */
  startDate: string;
  sprintLengthDays: number;
  capacityPerSprint: number;
}

/** Task of the reviewed plan (the epic is not stored). */
export type PlanTaskInput = Omit<PlanTask, 'epic'>;

/** POST /projects/:id/ai/plan/apply body. */
export interface ApplyPlanInput {
  method: PlanMethod;
  sprints: (Omit<PlanSprint, 'tasks'> & { tasks: PlanTaskInput[] })[];
  backlog: PlanTaskInput[];
}

/** 201 answer of the apply endpoint. */
export interface ApplyPlanResult {
  sprints: { id: string; name: string }[];
  tasksCreated: number;
  backlogTasks: number;
}
