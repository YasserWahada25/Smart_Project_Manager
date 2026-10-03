import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { ActiveSprint, describeDaysRemaining } from '../../../core/models/dashboard';

/** Active sprint: progress in story points, tasks, days left; links to its board. */
@Component({
  selector: 'app-active-sprint-card',
  imports: [DatePipe, RouterLink, MatProgressBarModule],
  template: `
    @let current = sprint();
    <article class="sprint">
      <header>
        <a
          [routerLink]="['/projects', current.project.id, 'board']"
          [queryParams]="{ sprint: current.id }"
        >
          {{ current.name }}
        </a>
        @if (showProject()) {
          <span class="project">{{ current.project.name }}</span>
        }
      </header>
      <mat-progress-bar
        mode="determinate"
        [value]="current.stats.progress"
        [attr.aria-label]="'Progress of ' + current.name"
      />
      <p class="numbers">
        {{ current.stats.completedPoints }} / {{ current.stats.totalPoints }} points ({{
          current.stats.progress
        }}%) · {{ current.stats.completedTasks }} / {{ current.stats.totalTasks }} tasks done
        @if (current.stats.blockedTasks > 0) {
          · <span class="alert">{{ current.stats.blockedTasks }} blocked</span>
        }
      </p>
      <p class="days" [class.alert]="current.daysRemaining < 0">
        {{ days() }} · ends {{ current.endDate | date: 'mediumDate' : 'UTC' }}
      </p>
    </article>
  `,
  styles: `
    .sprint {
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    a {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-primary);
    }
    .project,
    .numbers,
    .days {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .numbers {
      margin: 8px 0 0;
    }
    .days {
      margin: 4px 0 0;
    }
    .alert {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveSprintCard {
  readonly sprint = input.required<ActiveSprint>();
  readonly showProject = input(true);

  protected readonly days = computed(() => describeDaysRemaining(this.sprint().daysRemaining));
}
