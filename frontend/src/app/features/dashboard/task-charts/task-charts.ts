import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';

import { TaskIndicators } from '../../../core/models/dashboard';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskStatus,
} from '../../../core/models/task';
import { ChartView } from '../../../shared/components/chart/chart';

/** Fixed colors (a canvas cannot read the theme's CSS variables). */
const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: '#90a4ae',
  IN_PROGRESS: '#1e88e5',
  CODE_REVIEW: '#8e24aa',
  TESTING: '#00897b',
  DONE: '#43a047',
  BLOCKED: '#e53935',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: '#b0bec5',
  MEDIUM: '#42a5f5',
  HIGH: '#fb8c00',
  CRITICAL: '#e53935',
};

interface LegendEntry {
  label: string;
  value: number;
  color: string;
}

/** Tasks by status (doughnut) and by priority (bars), each with its values as text. */
@Component({
  selector: 'app-task-charts',
  imports: [ChartView],
  template: `
    @if (indicators().total === 0) {
      <p class="empty">No task yet: the charts appear once tasks are created.</p>
    } @else {
      <div class="charts">
        <figure>
          <figcaption>Tasks by status</figcaption>
          <app-chart [config]="statusChart()" label="Tasks by status" />
          <ul class="legend" aria-label="Tasks by status">
            @for (entry of statusLegend(); track entry.label) {
              <li>
                <span class="swatch" [style.background]="entry.color"></span>
                {{ entry.label }} <strong>{{ entry.value }}</strong>
              </li>
            }
          </ul>
        </figure>
        <figure>
          <figcaption>Tasks by priority</figcaption>
          <app-chart [config]="priorityChart()" label="Tasks by priority" />
          <ul class="legend" aria-label="Tasks by priority">
            @for (entry of priorityLegend(); track entry.label) {
              <li>
                <span class="swatch" [style.background]="entry.color"></span>
                {{ entry.label }} <strong>{{ entry.value }}</strong>
              </li>
            }
          </ul>
        </figure>
      </div>
    }
  `,
  styles: `
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    figure {
      margin: 0;
      padding: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    figcaption {
      margin-bottom: 8px;
      font: var(--mat-sys-title-small);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-small);
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 4px;
      border-radius: 2px;
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCharts {
  readonly indicators = input.required<TaskIndicators>();

  protected readonly statusLegend = computed<LegendEntry[]>(() =>
    TASK_STATUSES.map((status) => ({
      label: TASK_STATUS_LABELS[status],
      value: this.indicators().byStatus[status],
      color: STATUS_COLORS[status],
    })),
  );

  protected readonly priorityLegend = computed<LegendEntry[]>(() =>
    TASK_PRIORITIES.map((priority) => ({
      label: TASK_PRIORITY_LABELS[priority],
      value: this.indicators().byPriority[priority],
      color: PRIORITY_COLORS[priority],
    })),
  );

  protected readonly statusChart = computed<ChartConfiguration>(() => {
    const legend = this.statusLegend();
    return {
      type: 'doughnut',
      data: {
        labels: legend.map((entry) => entry.label),
        datasets: [
          {
            data: legend.map((entry) => entry.value),
            backgroundColor: legend.map((entry) => entry.color),
          },
        ],
      },
    };
  });

  protected readonly priorityChart = computed<ChartConfiguration>(() => {
    const legend = this.priorityLegend();
    return {
      type: 'bar',
      data: {
        labels: legend.map((entry) => entry.label),
        datasets: [
          {
            label: 'Tasks',
            data: legend.map((entry) => entry.value),
            backgroundColor: legend.map((entry) => entry.color),
          },
        ],
      },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
  });
}
