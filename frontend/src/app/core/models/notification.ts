import { Paginated } from './pagination';

/** Notification types generated from the activity history (docs/api.md §1.14). */
export type NotificationType =
  | 'ADDED_TO_PROJECT'
  | 'REMOVED_FROM_PROJECT'
  | 'TASK_ASSIGNED'
  | 'TASK_UNASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'SPRINT_STARTED';

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  ADDED_TO_PROJECT: 'group_add',
  REMOVED_FROM_PROJECT: 'group_remove',
  TASK_ASSIGNED: 'assignment_ind',
  TASK_UNASSIGNED: 'assignment_return',
  TASK_STATUS_CHANGED: 'swap_horiz',
  COMMENT_ADDED: 'comment',
  SPRINT_STARTED: 'rocket_launch',
};

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Ready-to-display text, e.g. `Sara Manager assigned you the task «Login»`. */
  message: string;
  actor: { id: string; firstName: string; lastName: string };
  project: string;
  task?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

/** GET /notifications also returns the number of unread notifications. */
export interface NotificationPage extends Paginated<AppNotification> {
  unreadCount: number;
}
