import { PROJECT_STATUS_LABELS, ProjectStatus } from './project';
import { SPRINT_STATUS_LABELS, SprintStatus } from './sprint';
import { TASK_STATUS_LABELS, TaskStatus } from './task';
import { fullName } from './user';

/** Events recorded by the backend in the activity history (docs/api.md §1.13). */
export type ActivityType =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_STATUS_CHANGED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'SPRINT_CREATED'
  | 'SPRINT_UPDATED'
  | 'SPRINT_STATUS_CHANGED'
  | 'SPRINT_DELETED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_ASSIGNED'
  | 'TASK_UNASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED'
  | 'COMMENT_ADDED';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  PROJECT_CREATED: 'Project created',
  PROJECT_UPDATED: 'Project updated',
  PROJECT_STATUS_CHANGED: 'Project status changed',
  MEMBER_ADDED: 'Member added',
  MEMBER_REMOVED: 'Member removed',
  SPRINT_CREATED: 'Sprint created',
  SPRINT_UPDATED: 'Sprint updated',
  SPRINT_STATUS_CHANGED: 'Sprint status changed',
  SPRINT_DELETED: 'Sprint deleted',
  TASK_CREATED: 'Task created',
  TASK_UPDATED: 'Task updated',
  TASK_ASSIGNED: 'Task assigned',
  TASK_UNASSIGNED: 'Task unassigned',
  TASK_STATUS_CHANGED: 'Task status changed',
  TASK_DELETED: 'Task deleted',
  COMMENT_ADDED: 'Comment added',
};

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

/** Snapshot kept by the backend so an entry stays readable after a deletion. */
export interface ActivityDetails {
  name?: string;
  title?: string;
  from?: string;
  to?: string;
  fields?: string[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  project: string;
  task?: string;
  sprint?: string;
  actor: PersonRef;
  /** User concerned (assignment, team change); null if the account no longer exists. */
  targetUser?: PersonRef | null;
  details: ActivityDetails;
  createdAt: string;
}

function label<T extends string>(labels: Record<T, string>, value: string | undefined): string {
  return value && value in labels ? labels[value as T] : (value ?? '?');
}

const person = (user: PersonRef | null | undefined) => (user ? fullName(user) : 'a former member');
const fieldList = (fields: string[] | undefined) =>
  fields && fields.length > 0 ? ` (${fields.join(', ')})` : '';

/** What the actor did, e.g. `moved «Login» from To do to In progress`. */
export function describeActivity(activity: Activity): string {
  const { details: d, targetUser } = activity;
  switch (activity.type) {
    case 'PROJECT_CREATED':
      return `created the project «${d.name}»`;
    case 'PROJECT_UPDATED':
      return `updated the project${fieldList(d.fields)}`;
    case 'PROJECT_STATUS_CHANGED':
      return `changed the project status from ${label<ProjectStatus>(PROJECT_STATUS_LABELS, d.from)} to ${label<ProjectStatus>(PROJECT_STATUS_LABELS, d.to)}`;
    case 'MEMBER_ADDED':
      return `added ${d.name ?? person(targetUser)} to the team`;
    case 'MEMBER_REMOVED':
      return `removed ${person(targetUser)} from the team`;
    case 'SPRINT_CREATED':
      return `created the sprint «${d.name}»`;
    case 'SPRINT_UPDATED':
      return `updated the sprint «${d.name}»${fieldList(d.fields)}`;
    case 'SPRINT_STATUS_CHANGED':
      return `moved the sprint «${d.name}» from ${label<SprintStatus>(SPRINT_STATUS_LABELS, d.from)} to ${label<SprintStatus>(SPRINT_STATUS_LABELS, d.to)}`;
    case 'SPRINT_DELETED':
      return `deleted the sprint «${d.name}»`;
    case 'TASK_CREATED':
      return `created the task «${d.title}»`;
    case 'TASK_UPDATED':
      return `updated the task «${d.title}»${fieldList(d.fields)}`;
    case 'TASK_ASSIGNED':
      return `assigned «${d.title}» to ${person(targetUser)}`;
    case 'TASK_UNASSIGNED':
      return `unassigned ${person(targetUser)} from «${d.title}»`;
    case 'TASK_STATUS_CHANGED':
      return `moved «${d.title}» from ${label<TaskStatus>(TASK_STATUS_LABELS, d.from)} to ${label<TaskStatus>(TASK_STATUS_LABELS, d.to)}`;
    case 'TASK_DELETED':
      return `deleted the task «${d.title}»`;
    case 'COMMENT_ADDED':
      return `commented on «${d.title}»`;
  }
}
