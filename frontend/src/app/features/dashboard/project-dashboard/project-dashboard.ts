import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiError } from '../../../core/models/api-error';
import { ProjectDashboardData, describeDaysRemaining } from '../../../core/models/dashboard';
import { SPRINT_STATUS_LABELS, SprintStatus } from '../../../core/models/sprint';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { ProjectContext } from '../../projects/project-context';
import { ActiveSprintCard } from '../active-sprint-card/active-sprint-card';
import { DashboardService } from '../dashboard.service';
import { TaskCharts } from '../task-charts/task-charts';
import { WorkloadTable } from '../workload-table/workload-table';

const SPRINT_STATUSES: readonly SprintStatus[] = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

/** "Dashboard" tab of a project: deadline, tasks, sprints and the workload of every member. */
@Component({
  selector: 'app-project-dashboard',
  imports: [LoadingState, ErrorState, TaskCharts, WorkloadTable, ActiveSprintCard],
  template: `
    @if (loading()) {
      <app-loading-state message="Loading the indicators…" />
    } @else if (errorMessage(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (data(); as current) {
      <ul class="kpis">
        <li [class.alert]="(current.project.daysRemaining ?? 0) < 0">
          <span class="value">{{ deadline() }}</span>
          <span class="label">deadline</span>
        </li>
        <li>
          <span class="value">{{ current.project.memberCount }}</span>
          <span class="label">{{ current.project.memberCount === 1 ? 'member' : 'members' }}</span>
        </li>
        <li>
          <span class="value">{{ current.tasks.total }}</span>
          <span class="label">tasks</span>
        </li>
        <li>
          <span class="value">{{ current.tasks.completed }}</span>
          <span class="label">done</span>
        </li>
        <li [class.alert]="current.tasks.blocked > 0">
          <span class="value">{{ current.tasks.blocked }}</span>
          <span class="label">blocked</span>
        </li>
        <li [class.alert]="current.tasks.overdue > 0">
          <span class="value">{{ current.tasks.overdue }}</span>
          <span class="label">overdue</span>
        </li>
      </ul>

      <section aria-labelledby="project-tasks-title">
        <h2 id="project-tasks-title">Tasks</h2>
        <app-task-charts [indicators]="current.tasks" />
      </section>

      <section aria-labelledby="project-sprints-title">
        <h2 id="project-sprints-title">Sprints</h2>
        <p class="sprint-counts">
          {{ current.sprints.total }} {{ current.sprints.total === 1 ? 'sprint' : 'sprints' }}
          @for (status of sprintStatuses; track status) {
            · {{ current.sprints.byStatus[status] }} {{ sprintLabels[status].toLowerCase() }}
          }
        </p>
        @if (current.sprints.activeSprint; as sprint) {
          <app-active-sprint-card [sprint]="sprint" [showProject]="false" />
        } @else {
          <p class="empty">No sprint in progress.</p>
        }
      </section>

      <section aria-labelledby="project-workload-title">
        <h2 id="project-workload-title">Team workload</h2>
        <app-workload-table [rows]="current.workload" />
      </section>
    }
  `,
  styleUrl: '../dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDashboard {
  private readonly context = inject(ProjectContext);
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sprintStatuses = SPRINT_STATUSES;
  protected readonly sprintLabels = SPRINT_STATUS_LABELS;
  protected readonly data = signal<ProjectDashboardData | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly deadline = computed(() => {
    const days = this.data()?.project.daysRemaining;
    return days === null || days === undefined ? 'Not set' : describeDaysRemaining(days);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.dashboardService
      .forProject(this.context.current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
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
}
