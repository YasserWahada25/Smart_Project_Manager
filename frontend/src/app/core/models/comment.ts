import { UserSummary } from './task';

export const COMMENT_MAX_LENGTH = 2000;

export interface Comment {
  id: string;
  task: string;
  project: string;
  author: UserSummary;
  content: string;
  /** Only once the comment has been edited. */
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}
