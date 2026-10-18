import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DashboardData } from '../../../core/models/dashboard';
import { AssignedTask } from '../../../core/models/task';
import { CommandPaletteService } from '../../command-palette/command-palette.service';
import { ActiveSprintCard } from '../../dashboard/active-sprint-card/active-sprint-card';
import { DashboardService } from '../../dashboard/dashboard.service';
import { TaskPriorityBadge, TaskStatusBadge } from '../../tasks/task-badges';
import { TaskService } from '../../tasks/task.service';

interface Figure {
  label: string;
  value: number;
  icon: string;
  alert?: boolean;
}

const MY_TASKS_SHOWN = 8;

/**
 * "My work" (Asana / ClickUp home, Linear "My issues"): quick actions, the figures that matter, then
 * the developer's open tasks (nearest deadline first) or the manager's active sprints with their AI
 * delay risk.
 */
@Component({
  selector: 'app-my-work',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ActiveSprintCard,
    TaskStatusBadge,
    TaskPriorityBadge,
  ],
  template: `
    <div class="quick" role="group" aria-label="Quick actions">
      <button type="button" class="quick-search" (click)="openPalette()">
        <mat-icon aria-hidden="true">search</mat-icon>
        <span>Search or jump to…</span>
        <kbd aria-hidden="true">Ctrl K</kbd>
      </button>
      @if (isManager()) {
        <a mat-stroked-button routerLink="/projects/new">
          <mat-icon>add</mat-icon>
          New project
        </a>
      }
      @if (isDeveloper()) {
        <a mat-stroked-button routerLink="/my-tasks">
          <mat-icon>task_alt</mat-icon>
          All my tasks
        </a>
      }
      <a mat-stroked-button routerLink="/dashboard">
        <mat-icon>insights</mat-icon>
        Dashboard
      </a>
    </div>

    @if (errorMessage(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }

    @if (figures().length > 0) {
      <ul class="figures" aria-label="Key figures">
        @for (figure of figures(); track figure.label) {
          <li [class.alert]="figure.alert">
            <mat-icon aria-hidden="true">{{ figure.icon }}</mat-icon>
            <span class="value">{{ figure.value }}</span>
            <span class="label">{{ figure.label }}</span>
          </li>
        }
      </ul>
    }

    @if (isDeveloper()) {
      <section aria-labelledby="my-tasks-title">
        <h2 id="my-tasks-title">Assigned to me</h2>
        <ul class="tasks">
          @for (task of myTasks(); track task.id) {
            <li [class.overdue]="task.isOverdue">
              <app-task-status [status]="task.status" />
              <a [routerLink]="['/projects', task.project.id, 'tasks', task.id]">{{
                task.title
              }}</a>
              <span class="meta">{{ task.project.name }}</span>
              <app-task-priority [priority]="task.priority" />
              <span class="meta deadline">
                @if (task.deadline) {
                  {{ task.deadline | date: 'MMM d' : 'UTC'
                  }}{{ task.isOverdue ? ' · overdue' : '' }}
                }
              </span>
            </li>
          } @empty {
            <li class="empty">{{ loaded() ? 'Nothing assigned to you for now.' : 'Loading…' }}</li>
          }
        </ul>
      </section>
    } @else {
      <section aria-labelledby="sprints-title">
        <h2 id="sprints-title">Active sprints</h2>
        @if (dashboard(); as data) {
          <div class="sprints">
            @for (sprint of data.sprints.activeSprints; track sprint.id) {
              <app-active-sprint-card [sprint]="sprint" />
            } @empty {
              <p class="empty">No active sprint. Start one from the Sprints tab of a project.</p>
            }
          </div>
        } @else {
          <p class="empty">Loading…</p>
        }
      </section>
    }
  `,
  styles: `
    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .quick-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 260px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--spm-border);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--spm-muted);
      font: var(--mat-sys-body-medium);
      cursor: pointer;
    }
    .quick-search span {
      flex: 1;
      text-align: left;
    }
    .quick-search:hover,
    .quick-search:focus-visible {
      border-color: var(--mat-sys-primary);
      outline: none;
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin: 0 0 24px;
      padding: 0;
      list-style: none;
    }
    .figures li {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      column-gap: 10px;
      padding: 12px 14px;
      border: 1px solid var(--spm-border);
      border-radius: var(--spm-radius);
      background: var(--mat-sys-surface);
    }
    .figures mat-icon {
      grid-row: span 2;
      color: var(--mat-sys-primary);
    }
    .figures .alert mat-icon,
    .figures .alert .value {
      color: var(--mat-sys-error);
    }
    .value {
      font: 600 22px/1.1 var(--mat-sys-headline-small-font, inherit);
    }
    .label,
    .meta,
    .empty {
      font: var(--mat-sys-body-small);
      color: var(--spm-muted);
    }
    h2 {
      margin: 0 0 10px;
      font: var(--mat-sys-title-medium);
    }
    .tasks {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--spm-border);
      border-radius: var(--spm-radius);
      background: var(--mat-sys-surface);
    }
    .tasks li {
      display: grid;
      grid-template-columns: auto 1fr auto auto 90px;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-top: 1px solid var(--spm-border);
    }
    .tasks li:first-child {
      border-top: 0;
    }
    .tasks a {
      overflow: hidden;
      color: inherit;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tasks a:hover {
      color: var(--mat-sys-primary);
    }
    .tasks .overdue .deadline {
      color: var(--mat-sys-error);
    }
    .tasks .empty {
      display: block;
    }
    .sprints {
      display: grid;
      gap: 12px;
    }
    .error {
      color: var(--mat-sys-error);
    }
    @media (max-width: 699px) {
      .tasks li {
        grid-template-columns: auto 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyWork {
  private readonly auth = inject(AuthService);
  private readonly palette = inject(CommandPaletteService);

  protected readonly isDeveloper = computed(() => this.auth.hasRole('DEVELOPER'));
  protected readonly isManager = computed(() => this.auth.hasRole('PROJECT_MANAGER'));
  protected readonly dashboard = signal<DashboardData | null>(null);
  protected readonly myTasks = signal<AssignedTask[]>([]);
  protected readonly loaded = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly figures = computed<Figure[]>(() => {
    const data = this.dashboard();
    if (!data) return [];
    const tasks = (this.isDeveloper() ? data.myTasks : undefined) ?? data.tasks;
    return [
      {
        label: this.isDeveloper() ? 'My open tasks' : 'Open tasks',
        value: tasks.total - tasks.completed,
        icon: 'radio_button_unchecked',
      },
      { label: 'Overdue', value: tasks.overdue, icon: 'event_busy', alert: tasks.overdue > 0 },
      { label: 'Blocked', value: tasks.blocked, icon: 'block', alert: tasks.blocked > 0 },
      { label: 'Active sprints', value: data.sprints.active, icon: 'flag' },
    ];
  });

  constructor() {
    inject(DashboardService)
      .get()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (data) => this.dashboard.set(data),
        error: () => this.errorMessage.set('Your figures could not be loaded.'),
      });

    if (this.isDeveloper()) {
      inject(TaskService)
        .assigned({ page: 1, limit: 20 })
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (page) => {
            this.myTasks.set(
              page.data.filter((task) => task.status !== 'DONE').slice(0, MY_TASKS_SHOWN),
            );
            this.loaded.set(true);
          },
          error: () => {
            this.loaded.set(true);
            this.errorMessage.set('Your tasks could not be loaded.');
          },
        });
    }
  }

  protected openPalette(): void {
    void this.palette.open();
  }
}
