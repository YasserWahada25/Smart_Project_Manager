import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, filter, finalize, of, switchMap } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { ApiError } from '../../../core/models/api-error';
import {
  SPRINT_STATUS_LABELS,
  Sprint,
  SprintStatus,
  isSprintOpen,
} from '../../../core/models/sprint';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { SprintRiskIndicator } from '../../ai-risk/sprint-risk/sprint-risk';
import { ProjectContext } from '../../projects/project-context';
import { SprintFormData, SprintFormDialog } from '../sprint-form-dialog/sprint-form-dialog';
import { SprintService } from '../sprint.service';

/** Confirmation asked before a sprint status change (none for "start"). */
const STATUS_CONFIRMATIONS: Partial<Record<SprintStatus, { title: string; message: string }>> = {
  COMPLETED: {
    title: 'Complete this sprint?',
    message: 'A completed sprint can no longer be modified and no task can be added to it.',
  },
  CANCELLED: {
    title: 'Cancel this sprint?',
    message: 'A cancelled sprint can no longer be modified and no task can be added to it.',
  },
};

/**
 * "Sprints" tab of a project: sprints in chronological order with their progress (story
 * points), and for the project manager the lifecycle actions (start, complete, cancel),
 * edition and deletion of planned sprints.
 */
@Component({
  selector: 'app-sprint-list',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    LoadingState,
    ErrorState,
    SprintRiskIndicator,
  ],
  templateUrl: './sprint-list.html',
  styleUrl: './sprint-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintList {
  private readonly context = inject(ProjectContext);
  private readonly sprintService = inject(SprintService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabels = SPRINT_STATUS_LABELS;
  protected readonly isOpen = isSprintOpen;
  protected readonly canEdit = this.context.canEdit;
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  /** Sprint being changed (its buttons are disabled meanwhile). */
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.sprintService
      .list(this.context.current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sprints) => {
          this.sprints.set(sprints);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof ApiError ? error.message : 'An unexpected error occurred.',
          );
          this.loading.set(false);
        },
      });
  }

  protected openForm(sprint?: Sprint): void {
    this.dialog
      .open<SprintFormDialog, SprintFormData, Sprint>(SprintFormDialog, {
        data: { projectId: this.context.current.id, sprint },
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.toast.success(
          sprint
            ? `The sprint "${saved.name}" has been updated.`
            : `The sprint "${saved.name}" has been created.`,
        );
        this.load();
      });
  }

  protected changeStatus(sprint: Sprint, status: SprintStatus): void {
    const confirmation = STATUS_CONFIRMATIONS[status];
    const confirmed: Observable<boolean> = confirmation
      ? this.confirmService.confirm({
          ...confirmation,
          confirmLabel: status === 'COMPLETED' ? 'Complete' : 'Cancel the sprint',
          destructive: status === 'CANCELLED',
        })
      : of(true);

    confirmed
      .pipe(
        filter(Boolean),
        switchMap(() => this.run(sprint, this.sprintService.setStatus(sprint.id, status))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        this.toast.success(`Sprint "${updated.name}": ${SPRINT_STATUS_LABELS[updated.status]}.`);
        this.load();
      });
  }

  protected deleteSprint(sprint: Sprint): void {
    this.confirmService
      .confirm({
        title: 'Delete this sprint?',
        message: `"${sprint.name}" will be deleted. Its tasks go back to the backlog.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.run(sprint, this.sprintService.delete(sprint.id))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(`The sprint "${sprint.name}" has been deleted.`);
        this.load();
      });
  }

  private run<T>(sprint: Sprint, request: Observable<T>): Observable<T> {
    this.busyId.set(sprint.id);
    return request.pipe(
      catchError((error: unknown) => {
        const message = actionErrorMessage(error);
        if (message) this.toast.error(message);
        return EMPTY;
      }),
      finalize(() => this.busyId.set(null)),
    );
  }
}
