/** Roles defined by the backend (users.role). */
export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';

export const ROLES: readonly Role[] = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  PROJECT_MANAGER: 'Project manager',
  DEVELOPER: 'Developer',
};

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

/** From the lowest to the highest level (same order as the backend). */
export const SKILL_LEVELS: readonly SkillLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'EXPERT',
];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export interface Skill {
  name: string;
  level: SkillLevel;
  yearsOfExperience?: number;
}

/** "First Last" of any user reference. */
export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
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
