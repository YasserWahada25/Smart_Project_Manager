import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskStatus,
} from '../../core/models/task';

/** Workflow status of a task, colored by status. */
@Component({
  selector: 'app-task-status',
  template: `<span class="badge" [attr.data-status]="status()">{{ labels[status()] }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    [data-status='IN_PROGRESS'],
    [data-status='CODE_REVIEW'],
    [data-status='TESTING'] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    [data-status='DONE'] {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    [data-status='BLOCKED'] {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskStatusBadge {
  readonly status = input.required<TaskStatus>();
  protected readonly labels = TASK_STATUS_LABELS;
}

/** Priority of a task; HIGH and CRITICAL stand out. */
@Component({
  selector: 'app-task-priority',
  template: `<span class="badge" [attr.data-priority]="priority()">{{ labels[priority()] }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
      border: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
    }
    [data-priority='HIGH'] {
      border-color: var(--mat-sys-tertiary);
      color: var(--mat-sys-tertiary);
    }
    [data-priority='CRITICAL'] {
      border-color: var(--mat-sys-error);
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskPriorityBadge {
  readonly priority = input.required<TaskPriority>();
  protected readonly labels = TASK_PRIORITY_LABELS;
}
