import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EMPTY, Observable, catchError, filter, of, switchMap, tap } from 'rxjs';

import { actionErrorMessage } from '../../core/http/action-error';
import {
  STATUSES_REQUIRING_ASSIGNEE,
  TASK_STATUS_LABELS,
  TASK_TRANSITIONS,
  Task,
  TaskStatus,
} from '../../core/models/task';
import { ToastService } from '../../core/services/toast.service';
import { BlockReasonDialog } from './block-reason-dialog/block-reason-dialog';
import { TaskService } from './task.service';

/**
 * Status changes of a task, shared by the task page and the Kanban board. The rules mirror
 * the backend (which enforces them again): allowed transitions, assignee required to work on a
 * task, optional reason when blocking.
 */
@Injectable({ providedIn: 'root' })
export class TaskWorkflow {
  private readonly taskService = inject(TaskService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  /** Statuses the task can move to from its current status. */
  targets(task: Pick<Task, 'status'>): readonly TaskStatus[] {
    return TASK_TRANSITIONS[task.status];
  }

  /** The move needs an assignee the task does not have. */
  needsAssignee(task: Pick<Task, 'assignee'>, target: TaskStatus): boolean {
    return task.assignee === null && STATUSES_REQUIRING_ASSIGNEE.includes(target);
  }

  /**
   * Asks for the blocking reason when moving to BLOCKED (cancel = no change), then changes the
   * status. Emits the updated task; on failure the backend message is shown and nothing is
   * emitted.
   */
  move(task: Pick<Task, 'id' | 'title'>, target: TaskStatus): Observable<Task> {
    const reason: Observable<string | undefined> =
      target === 'BLOCKED'
        ? this.dialog
            .open<BlockReasonDialog, { title: string }, string>(BlockReasonDialog, {
              data: { title: task.title },
              width: '480px',
              maxWidth: 'calc(100vw - 32px)',
            })
            .afterClosed()
        : of('');

    return reason.pipe(
      filter((value): value is string => value !== undefined),
      switchMap((value) =>
        this.taskService.setStatus(task.id, target, value || undefined).pipe(
          tap((updated) =>
            this.toast.success(
              `"${updated.title}" moved to ${TASK_STATUS_LABELS[updated.status]}.`,
            ),
          ),
          catchError((error: unknown) => {
            const message = actionErrorMessage(error);
            if (message) this.toast.error(message);
            return EMPTY;
          }),
        ),
      ),
    );
  }
}
