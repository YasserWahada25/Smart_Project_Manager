import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, filter, finalize, switchMap } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { ApiError } from '../../../core/models/api-error';
import { Sprint } from '../../../core/models/sprint';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS, Task, TaskStatus } from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { TaskHistory } from '../../activity/task-history/task-history';
import {
  RecommendDialog,
  RecommendDialogData,
} from '../../ai-recommendation/recommend-dialog/recommend-dialog';
import { TaskComments } from '../../comments/task-comments/task-comments';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskPriorityBadge, TaskStatusBadge } from '../task-badges';
import { TaskFormData, TaskFormDialog } from '../task-form-dialog/task-form-dialog';
import { TaskWorkflow } from '../task-workflow';
import { TaskService } from '../task.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

/**
 * Task page (`/projects/:id/tasks/:taskId`): details, workflow moves (manager and assignee),
 * and for the project manager: assignment, edition and deletion.
 */
@Component({
  selector: 'app-task-detail',
  imports: [
    Avatar,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    LoadingState,
    ErrorState,
    TaskStatusBadge,
    TaskPriorityBadge,
    TaskComments,
    TaskHistory,
  ],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetail {
  /** Route parameter. */
  readonly taskId = input.required<string>();
  /** Shown in the side panel (TaskPanel): no "All tasks" link. */
  readonly embedded = input(false);

  private readonly context = inject(ProjectContext);
  private readonly taskService = inject(TaskService);
  private readonly sprintService = inject(SprintService);
  private readonly workflow = inject(TaskWorkflow);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly typeLabels = TASK_TYPE_LABELS;
  protected readonly fullName = fullName;
  protected readonly tasksLink = ['/projects', this.context.current.id, 'tasks'];
  protected readonly canEdit = this.context.canEdit;
  protected readonly members = this.context.activeMembers;

  protected readonly task = signal<Task | null>(null);
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<{ message: string; retryable: boolean } | null>(null);
  protected readonly busy = signal(false);
  /** Incremented after each change, to reload the history of the task. */
  protected readonly historyVersion = signal(0);
  /** '' = unassigned. */
  protected readonly assignee = new FormControl('', { nonNullable: true });

  protected readonly canMove = computed(() => {
    const task = this.task();
    return task !== null && this.context.canChangeStatus(task);
  });
  protected readonly targets = computed(() => {
    const task = this.task();
    return task ? this.workflow.targets(task) : [];
  });
  protected readonly sprintName = computed(() => {
    const sprintId = this.task()?.sprint;
    if (!sprintId) return 'Backlog';
    return this.sprints().find((sprint) => sprint.id === sprintId)?.name ?? '—';
  });

  constructor() {
    this.sprintService
      .list(this.context.current.id)
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (sprints) => this.sprints.set(sprints), error: () => undefined });

    toObservable(this.taskId)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.taskService
      .get(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (task) => {
          this.show(task);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(
            error instanceof ApiError
              ? { message: error.message, retryable: error.isNetworkError || error.status >= 500 }
              : { message: 'An unexpected error occurred.', retryable: true },
          );
          this.loading.set(false);
        },
      });
  }

  protected needsAssignee(target: TaskStatus): boolean {
    const task = this.task();
    return task !== null && this.workflow.needsAssignee(task, target);
  }

  protected move(target: TaskStatus): void {
    const task = this.task();
    if (!task) return;
    this.busy.set(true);
    this.workflow
      .move(task, target)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => this.changed(updated));
  }

  /** Assignment by the project manager ('' = unassign). */
  protected assign(assigneeId: string): void {
    const task = this.task();
    if (!task) return;
    this.busy.set(true);
    this.taskService
      .setAssignee(task.id, assigneeId || null)
      .pipe(
        catchError((error: unknown) => {
          const message = actionErrorMessage(error);
          if (message) this.toast.error(message);
          this.assignee.setValue(task.assignee?.id ?? '');
          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        this.changed(updated);
        this.toast.success(
          updated.assignee
            ? `"${updated.title}" assigned to ${fullName(updated.assignee)}.`
            : `"${updated.title}" is now unassigned.`,
        );
      });
  }

  /** AI-02: ranked developers; the dialog closes with the task once one is assigned. */
  protected recommend(): void {
    const task = this.task();
    if (!task) return;
    this.dialog
      .open<RecommendDialog, RecommendDialogData, Task>(RecommendDialog, {
        data: { taskId: task.id, taskTitle: task.title },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        this.changed(updated);
        if (updated.assignee) {
          this.toast.success(`"${updated.title}" assigned to ${fullName(updated.assignee)}.`);
        }
      });
  }

  protected edit(): void {
    const task = this.task();
    if (!task) return;
    this.dialog
      .open<TaskFormDialog, TaskFormData, Task>(TaskFormDialog, {
        data: {
          projectId: this.context.current.id,
          task,
          sprints: this.sprints(),
          members: this.members(),
        },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        this.changed(updated);
        this.toast.success('The task has been updated.');
      });
  }

  protected deleteTask(): void {
    const task = this.task();
    if (!task) return;
    this.confirmService
      .confirm({
        title: 'Delete this task?',
        message: `"${task.title}" and its comments will be permanently deleted.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return this.taskService.delete(task.id).pipe(
            catchError((error: unknown) => {
              const message = actionErrorMessage(error);
              if (message) this.toast.error(message);
              return EMPTY;
            }),
            finalize(() => this.busy.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success('The task has been deleted.');
        void this.router.navigate(this.tasksLink);
      });
  }

  protected historyChanged(): void {
    this.historyVersion.update((version) => version + 1);
  }

  private changed(task: Task): void {
    this.show(task);
    this.historyChanged();
  }

  private show(task: Task): void {
    this.task.set(task);
    this.assignee.setValue(task.assignee?.id ?? '', { emitEvent: false });
  }
}
