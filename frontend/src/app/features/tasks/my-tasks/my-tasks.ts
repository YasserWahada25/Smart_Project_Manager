import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import {
  AssignedTask,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskStatus,
} from '../../../core/models/task';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { PagedList } from '../../../shared/data/paged-list';
import { TaskPriorityBadge, TaskStatusBadge } from '../task-badges';
import { AssignedTaskQuery, TaskService } from '../task.service';

/** "My tasks": tasks assigned to the signed-in user, nearest deadline first. */
@Component({
  selector: 'app-my-tasks',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    ErrorState,
    TaskStatusBadge,
    TaskPriorityBadge,
  ],
  templateUrl: './my-tasks.html',
  styleUrl: './my-tasks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTasks {
  private readonly taskService = inject(TaskService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly status = new FormControl<TaskStatus | ''>('', { nonNullable: true });
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = 20;
  private readonly list = new PagedList<AssignedTaskQuery, AssignedTask>(
    (query) => this.taskService.assigned(query),
    this.destroyRef,
  );
  protected readonly tasks = this.list.items;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly errorMessage = this.list.errorMessage;

  constructor() {
    this.status.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
    this.load();
  }

  protected load(): void {
    this.list.load({
      page: this.pageIndex() + 1,
      limit: this.pageSize,
      status: this.status.value || undefined,
    });
  }

  protected changePage({ pageIndex }: PageEvent): void {
    this.pageIndex.set(pageIndex);
    this.load();
  }
}
