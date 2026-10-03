import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/models/api-error';
import { DashboardData } from '../../../core/models/dashboard';
import { ROLES, ROLE_LABELS } from '../../../core/models/user';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { ActiveSprintCard } from '../active-sprint-card/active-sprint-card';
import { DashboardService } from '../dashboard.service';
import { TaskCharts } from '../task-charts/task-charts';
import { WorkloadTable } from '../workload-table/workload-table';

/**
 * Global dashboard (`/dashboard`): indicators over the projects the user can see — all for an
 * administrator, managed projects for a project manager, member projects for a developer —
 * plus the team workload (managers, administrators), the user's own tasks (developers) and the
 * accounts of the platform (administrators).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    MatCardModule,
    MatIconModule,
    LoadingState,
    ErrorState,
    TaskCharts,
    WorkloadTable,
    ActiveSprintCard,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: '../dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.dashboardService
      .get()
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
