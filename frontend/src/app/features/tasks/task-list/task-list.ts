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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, merge } from 'rxjs';

import { Sprint } from '../../../core/models/sprint';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { PagedList } from '../../../shared/data/paged-list';
import { TaskPanelService } from '../task-panel/task-panel';
import { ProjectContext } from '../../projects/project-context';
import { SprintService } from '../../sprints/sprint.service';
import { TaskPriorityBadge, TaskStatusBadge } from '../task-badges';
import { TaskFormData, TaskFormDialog } from '../task-form-dialog/task-form-dialog';
import { TaskQuery, TaskService } from '../task.service';
import { Avatar } from '../../../shared/components/avatar/avatar';

/**
 * "Tasks" tab of a project: filters (search, status, priority, type, assignee, sprint,
 * overdue), paginated table, and task creation for the project manager. `?sprint=<id>` opens
 * the list filtered on a sprint (link from the Sprints tab).
 */
@Component({
  selector: 'app-task-list',
  imports: [
    Avatar,
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    ErrorState,
    TaskStatusBadge,
    TaskPriorityBadge,
  ],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskList {
  private readonly context = inject(ProjectContext);
  private readonly taskService = inject(TaskService);
  private readonly sprintService = inject(SprintService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly taskPanel = inject(TaskPanelService);
  private readonly injector = inject(Injector);

  protected readonly columns = [
    'title',
    'status',
    'priority',
    'complexity',
    'assignee',
    'sprint',
    'deadline',
  ];
  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly types = TASK_TYPES;
  protected readonly typeLabels = TASK_TYPE_LABELS;
  protected readonly fullName = fullName;
  protected readonly canEdit = this.context.canEdit;
  protected readonly members = computed(() => this.context.project()?.members ?? []);
  protected readonly sprints = signal<Sprint[]>([]);
  private readonly sprintNames = computed(
    () => new Map(this.sprints().map((sprint) => [sprint.id, sprint.name])),
  );

  protected readonly filters = inject(NonNullableFormBuilder).group({
    search: [''],
    status: ['' as TaskStatus | ''],
    priority: ['' as TaskPriority | ''],
    type: ['' as TaskType | ''],
    /** '' = all, 'unassigned' or a user id. */
    assignee: [''],
    /** '' = all, 'backlog' or a sprint id. */
    sprint: [inject(ActivatedRoute).snapshot.queryParamMap.get('sprint') ?? ''],
    overdue: [false],
  });
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  private readonly list = new PagedList<TaskQuery, Task>(
    (query) => this.taskService.list(this.context.current.id, query),
    this.destroyRef,
  );
  protected readonly tasks = this.list.items;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly errorMessage = this.list.errorMessage;

  constructor() {
    this.sprintService
      .list(this.context.current.id)
      .pipe(takeUntilDestroyed())
      // The sprint filter and names are optional: the list still works without them.
      .subscribe({ next: (sprints) => this.sprints.set(sprints), error: () => undefined });

    const { search, ...others } = this.filters.controls;
    merge(
      search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
      ...Object.values(others).map((control) => control.valueChanges),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    this.load();
  }

  protected load(): void {
    const { search, status, priority, type, assignee, sprint, overdue } =
      this.filters.getRawValue();
    this.list.load({
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      search,
      status: status || undefined,
      priority: priority || undefined,
      type: type || undefined,
      assignee: assignee || undefined,
      sprint: sprint || undefined,
      overdue: overdue || undefined,
    });
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

  protected changePage({ pageIndex, pageSize }: PageEvent): void {
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
    this.load();
  }

  protected typeLabel(type: TaskType): string {
    return TASK_TYPE_LABELS[type];
  }

  protected sprintName(task: Task): string {
    return task.sprint ? (this.sprintNames().get(task.sprint) ?? '—') : 'Backlog';
  }

  protected openCreate(): void {
    const sprint = this.filters.controls.sprint.value;
    this.dialog
      .open<TaskFormDialog, TaskFormData, Task>(TaskFormDialog, {
        data: {
          projectId: this.context.current.id,
          sprints: this.sprints(),
          members: this.context.activeMembers(),
          sprintId: sprint && sprint !== 'backlog' ? sprint : null,
        },
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((task) => {
        this.toast.success(`The task "${task.title}" has been created.`);
        this.load();
      });
  }
}
