/** Roles defined by the backend (users.role). */
export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  PROJECT_MANAGER: 'Project manager',
  DEVELOPER: 'Developer',
};

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Skill {
  name: string;
  level: SkillLevel;
  yearsOfExperience?: number;
}

/** User object returned by the backend (never contains the password). */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  jobTitle: string;
  bio: string;
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
}
