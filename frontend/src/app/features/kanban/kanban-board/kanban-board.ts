import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { SPRINT_STATUS_LABELS, Sprint } from '../../../core/models/sprint';
import { Board, BoardTask, TASK_STATUS_LABELS, TaskStatus } from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskPriorityBadge } from '../../tasks/task-badges';
import { TaskWorkflow } from '../../tasks/task-workflow';
import { TaskService } from '../../tasks/task.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

type BoardOutcome = { ok: true; board: Board } | { ok: false; message: string };

/**
 * "Board" tab of a project: Kanban columns TODO → DONE plus BLOCKED, for one sprint (the
 * active one by default), the backlog or all the tasks. The project manager and the assignee
 * move a task with its "Move to" menu (allowed transitions only).
 */
@Component({
  selector: 'app-kanban-board',
  imports: [
    Avatar,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    ErrorState,
    TaskPriorityBadge,
  ],
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanBoard {
  private readonly context = inject(ProjectContext);
  private readonly taskService = inject(TaskService);
  private readonly sprintService = inject(SprintService);
  private readonly workflow = inject(TaskWorkflow);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly sprintStatusLabels = SPRINT_STATUS_LABELS;
  protected readonly fullName = fullName;
  protected readonly projectId = this.context.current.id;
  protected readonly sprints = signal<Sprint[]>([]);
  /** '' = all the tasks, 'backlog' or a sprint id. */
  protected readonly scope = new FormControl('', { nonNullable: true });
  protected readonly board = signal<Board | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  /** Task being moved (its menu is disabled meanwhile). */
  protected readonly movingId = signal<string | null>(null);

  private readonly loads = new Subject<string>();

  constructor() {
    this.loads
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        // Only the board of the latest scope is displayed.
        switchMap((scope) =>
          this.taskService.board(this.projectId, scope || undefined).pipe(
            map((board): BoardOutcome => ({ ok: true, board })),
            catchError((error: unknown) =>
              of<BoardOutcome>({
                ok: false,
                message:
                  error instanceof ApiError ? error.message : 'An unexpected error occurred.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        if (outcome.ok) this.board.set(outcome.board);
        else this.errorMessage.set(outcome.message);
        this.loading.set(false);
      });

    this.scope.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());

    // Default scope: ?sprint=… from the Sprints tab, otherwise the active sprint, otherwise all.
    const requested = inject(ActivatedRoute).snapshot.queryParamMap.get('sprint');
    this.sprintService
      .list(this.projectId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (sprints) => {
          this.sprints.set(sprints);
          const active = sprints.find((sprint) => sprint.status === 'ACTIVE');
          this.scope.setValue(requested ?? active?.id ?? '');
        },
        error: () => this.scope.setValue(requested ?? ''),
      });
  }

  protected load(): void {
    this.loads.next(this.scope.value);
  }

  protected canMove(task: BoardTask): boolean {
    return this.context.canChangeStatus(task);
  }

  protected targets(task: BoardTask): readonly TaskStatus[] {
    return this.workflow.targets(task);
  }

  protected needsAssignee(task: BoardTask, target: TaskStatus): boolean {
    return this.workflow.needsAssignee(task, target);
  }

  protected move(task: BoardTask, target: TaskStatus): void {
    this.movingId.set(task.id);
    this.workflow
      .move(task, target)
      .pipe(
        finalize(() => this.movingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.load());
  }
}
