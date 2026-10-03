import { ProjectStatus } from './project';
import { Sprint, SprintStats, SprintStatus } from './sprint';
import { TaskPriority, TaskStatus, TaskType } from './task';
import { Role } from './user';

/** Task counts of a set of projects (or of the caller's tasks). */
export interface TaskIndicators {
  total: number;
  completed: number;
  blocked: number;
  /** Deadline passed and not DONE. */
  overdue: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
}

/** Open work (tasks not DONE) of one person. */
export interface WorkloadRow {
  user: { id: string; firstName: string; lastName: string; email: string };
  openTasks: number;
  openPoints: number;
  inProgressTasks: number;
  blockedTasks: number;
}

export interface ActiveSprint extends Omit<Sprint, 'project' | 'stats'> {
  project: { id: string; name: string };
  /** Days until the end date (negative = late). */
  daysRemaining: number;
  stats: SprintStats;
}

/** GET /dashboard: indicators over the projects the caller can see. */
export interface DashboardData {
  role: Role;
  projects: { total: number; active: number; byStatus: Record<ProjectStatus, number> };
  sprints: { active: number; activeSprints: ActiveSprint[] };
  tasks: TaskIndicators;
  /** PROJECT_MANAGER and ADMIN. */
  workload?: WorkloadRow[];
  /** DEVELOPER: the caller's own tasks. */
  myTasks?: TaskIndicators;
  /** ADMIN. */
  platform?: {
    users: { total: number; active: number; inactive: number; byRole: Record<Role, number> };
  };
}

/** GET /projects/:id/dashboard. */
export interface ProjectDashboardData {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    startDate: string;
    deadline?: string;
    /** null when the project has no deadline. */
    daysRemaining: number | null;
    memberCount: number;
  };
  tasks: TaskIndicators;
  sprints: {
    total: number;
    byStatus: Record<SprintStatus, number>;
    activeSprint: ActiveSprint | null;
  };
  /** Every member, including those without open tasks. */
  workload: WorkloadRow[];
}

/** GET /search. */
export interface SearchResults {
  query: string;
  projects: {
    total: number;
    items: { id: string; name: string; description: string; status: ProjectStatus }[];
  };
  tasks: {
    total: number;
    items: {
      id: string;
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      type: TaskType;
      project: { id: string; name: string };
      assignee: { id: string; firstName: string; lastName: string } | null;
    }[];
  };
}

/** "5 days left", "Ends today", "2 days late". */
export function describeDaysRemaining(days: number): string {
  if (days === 0) return 'Ends today';
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} left`;
  return `${-days} ${days === -1 ? 'day' : 'days'} late`;
}
