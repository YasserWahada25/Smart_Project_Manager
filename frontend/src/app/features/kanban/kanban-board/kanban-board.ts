import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';

import { ApiError } from '../../../core/models/api-error';
import { SPRINT_STATUS_LABELS, Sprint } from '../../../core/models/sprint';
import {
  Board,
  BoardTask,
  TASK_LIMITS,
  TASK_STATUS_LABELS,
  TaskStatus,
} from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskPriorityBadge } from '../../tasks/task-badges';
import { TaskPanelService } from '../../tasks/task-panel/task-panel';
import { TaskWorkflow } from '../../tasks/task-workflow';
import { TaskService } from '../../tasks/task.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

type BoardOutcome = { ok: true; board: Board } | { ok: false; message: string };

/**
 * "Board" tab of a project: Kanban columns TODO → DONE plus BLOCKED, for one sprint (the
 * active one by default), the backlog or all the tasks. The project manager and the assignee
 * move a task by **drag and drop** (Trello / Linear style: only the allowed columns accept it and
 * are highlighted) or with its "Move to" menu (keyboard alternative). The manager adds a task
 * directly in the To do column.
 */
@Component({
  selector: 'app-kanban-board',
  imports: [
    Avatar,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    DatePipe,
    ReactiveFormsModule,
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
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly taskPanel = inject(TaskPanelService);
  private readonly injector = inject(Injector);

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
  /** Task being dragged: the columns that accept it are highlighted. */
  protected readonly dragged = signal<BoardTask | null>(null);

  /** Quick add (manager): in the backlog or an open sprint, not in a closed one. */
  protected readonly canQuickAdd = computed(() => {
    if (!this.context.canEdit()) return false;
    const scope = this.scopeValue();
    const sprint = this.sprints().find((item) => item.id === scope);
    return !sprint || sprint.status === 'PLANNED' || sprint.status === 'ACTIVE';
  });
  protected readonly adding = signal(false);
  protected readonly creating = signal(false);
  protected readonly newTitle = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(TASK_LIMITS.titleMaxLength),
    ],
  });
  protected readonly titleMaxLength = TASK_LIMITS.titleMaxLength;
  private readonly scopeValue = signal('');

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

    this.scope.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.scopeValue.set(value);
      this.load();
    });

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

  /** A column accepts the card it already holds, or an allowed move (assignee present if needed). */
  protected readonly canEnter = (
    drag: CdkDrag<BoardTask>,
    drop: CdkDropList<TaskStatus>,
  ): boolean => drag.data.status === drop.data || this.isAllowedTarget(drag.data, drop.data);

  /** While dragging: the column can receive the card (highlighted). */
  protected isDropAllowed(status: TaskStatus): boolean {
    const task = this.dragged();
    return !!task && task.status !== status && this.isAllowedTarget(task, status);
  }

  /** While dragging: the column refuses the card (dimmed). */
  protected isDropForbidden(status: TaskStatus): boolean {
    const task = this.dragged();
    return !!task && task.status !== status && !this.isAllowedTarget(task, status);
  }

  protected isAllowedTarget(task: BoardTask, target: TaskStatus): boolean {
    return this.targets(task).includes(target) && !this.needsAssignee(task, target);
  }

  protected drop(event: CdkDragDrop<TaskStatus, TaskStatus, BoardTask>): void {
    this.dragged.set(null);
    const task = event.item.data;
    const target = event.container.data;
    if (event.previousContainer === event.container || !this.isAllowedTarget(task, target)) return;
    // Optimistic: the card is shown in its new column right away; the board is then reloaded
    // (it returns to its column if the move is refused or the blocking reason is cancelled).
    this.board.update((board) => (board ? moveCard(board, task, target) : board));
    this.move(task, target);
  }

  /** Full page of a task: plain href (Ctrl/⌘-click opens it in a new tab; a click opens the panel). */
  protected taskUrl(taskId: string): string {
    return `/projects/${this.context.current.id}/tasks/${taskId}`;
  }

  /**
   * Opens the task in the side panel (Linear / Jira "peek"); Ctrl/⌘-click or middle click keep the
   * link's default behaviour (full page, new tab). The view is refreshed when the panel closes.
   */
  protected openTask(event: MouseEvent, taskId: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    this.taskPanel
      .open({ projectId: this.context.current.id, taskId }, this.injector)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  protected startAdding(): void {
    this.newTitle.reset('');
    this.adding.set(true);
  }

  protected cancelAdding(): void {
    this.adding.set(false);
  }

  /** Quick add (Trello's "Add a card"): title only, defaults for the rest, in the shown scope. */
  protected addTask(): void {
    if (this.newTitle.invalid || this.creating()) return;
    const scope = this.scope.value;
    this.creating.set(true);
    this.taskService
      .create(this.projectId, {
        title: this.newTitle.value.trim(),
        description: '',
        type: 'FEATURE',
        priority: 'MEDIUM',
        complexity: 3,
        deadline: null,
        requiredSkills: [],
        sprint: scope && scope !== 'backlog' ? scope : null,
        assignee: null,
      })
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (task) => {
          this.toast.success(`"${task.title}" added to To do.`);
          this.newTitle.reset('');
          this.load();
        },
        error: (error: unknown) => {
          const message = actionErrorMessage(error);
          if (message) this.toast.error(message);
        },
      });
  }

  protected move(task: BoardTask, target: TaskStatus): void {
    this.movingId.set(task.id);
    this.workflow
      .move(task, target)
      .pipe(
        finalize(() => this.movingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      // Reloaded whatever happens: success, refusal or cancelled blocking reason.
      .subscribe({ complete: () => this.load() });
  }
}

/** The board with `task` moved to the top of the `target` column. */
function moveCard(board: Board, task: BoardTask, target: TaskStatus): Board {
  const moved = { ...task, status: target };
  return {
    ...board,
    columns: board.columns.map((column) => {
      const tasks = column.tasks.filter((item) => item.id !== task.id);
      if (column.status === target) tasks.unshift(moved);
      return { ...column, tasks, count: tasks.length };
    }),
  };
}
