import { SprintStatus } from './sprint';
import { Task, TaskPriority, TaskType } from './task';

/** AI-05 — retrospective of a completed sprint (docs/api.md § 1.17). */
export interface RetrospectiveAction {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  /** Task created from this action (once), or null. */
  task: string | null;
}

/** Computed by code from the sprint's tasks, never by the LLM. */
export interface RetrospectiveMetrics {
  totalTasks: number;
  doneTasks: number;
  totalPoints: number;
  donePoints: number;
  /** Share of the committed story points delivered, 0–1. */
  completionRate: number;
  durationDays: number;
  /** Story points per day. */
  velocity: number;
  historicalVelocity: number | null;
  /** velocity ÷ historical velocity − 1 (null without a previous sprint). */
  velocityChange: number | null;
  blockedTasks: number;
  blockedDuringSprint: number;
  addedAfterStart: number;
  lateTasks: number;
  unassignedOpen: number;
}

export interface Retrospective {
  id: string;
  sprint: { id: string; name: string; status: SprintStatus; startDate: string; endDate: string };
  /** llm = written by the language model; local = built by rules from the figures. */
  method: 'llm' | 'local';
  model: string | null;
  summary: string;
  delivered: string[];
  slipped: string[];
  blockers: string[];
  wentWell: string[];
  toImprove: string[];
  actions: RetrospectiveAction[];
  metrics: RetrospectiveMetrics;
  warnings: string[];
  generatedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

/** GET / POST /sprints/:id/ai/retrospective */
export interface RetrospectiveResult {
  retrospective: Retrospective | null;
}

/** POST /sprints/:id/ai/retrospective/actions/:actionId/task (201) */
export interface RetrospectiveTaskResult {
  task: Task;
  retrospective: Retrospective;
}
