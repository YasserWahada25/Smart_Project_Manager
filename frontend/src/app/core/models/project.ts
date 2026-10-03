import { Skill } from './user';

/** Project lifecycle (backend: models/project.model.js). */
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

/** Backend limits (PROJECT_LIMITS). */
export const PROJECT_LIMITS = {
  nameMaxLength: 100,
  descriptionMaxLength: 2000,
  maxTechnologies: 30,
  technologyMaxLength: 50,
  maxMembers: 50,
} as const;

/** Public fields of the project manager (populated by the backend). */
export interface ProjectManager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
}

/** Team member: an active or deactivated DEVELOPER account. */
export interface ProjectMember extends ProjectManager {
  isActive: boolean;
  skills: Skill[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  /** ISO date-time at midnight UTC (the backend receives `YYYY-MM-DD`). */
  startDate: string;
  /** Absent when no deadline is set. */
  deadline?: string;
  status: ProjectStatus;
  technologies: string[];
  manager: ProjectManager;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /projects and PATCH /projects/:id (`deadline: null` removes it). */
export interface ProjectInput {
  name: string;
  description: string;
  startDate: string;
  deadline: string | null;
  technologies: string[];
}

/** Entry of the developer directory (GET /developers): active DEVELOPER accounts. */
export interface Developer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  skills: Skill[];
}
