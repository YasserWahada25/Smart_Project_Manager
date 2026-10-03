import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';

import { TaskIndicators } from '../../../core/models/dashboard';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../../../core/models/task';
import { ChartView } from '../../../shared/components/chart/chart';

/**
 * Both charts compare counts per category: one hue, horizontal bars, the categories named on
 * the axis (no color legend needed). Values are also listed as text (accessible table view).
 * Color validated with the data-viz palette checker (contrast ≥ 3:1 on the light surface).
 */
const BAR_COLOR = '#2a78d6';
const GRID_COLOR = '#e4e4e0';
const TEXT_COLOR = '#52514e';

interface Entry {
  label: string;
  value: number;
}

function barChart(entries: Entry[]): ChartConfiguration {
  return {
    type: 'bar',
    data: {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          label: 'Tasks',
          data: entries.map((entry) => entry.value),
          backgroundColor: BAR_COLOR,
          // Thin bars, rounded at the data end only, square at the baseline.
          maxBarThickness: 24,
          borderRadius: 4,
          borderSkipped: 'start',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
          border: { display: false },
        },
        y: { ticks: { color: TEXT_COLOR }, grid: { display: false } },
      },
    },
  };
}

/** Tasks by status and by priority. */
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
          <app-chart [config]="statusChart()" label="Tasks by status (values listed below)" />
          <ul class="values" aria-label="Tasks by status">
            @for (entry of byStatus(); track entry.label) {
              <li>
                {{ entry.label }} <strong>{{ entry.value }}</strong>
              </li>
            }
          </ul>
        </figure>
        <figure>
          <figcaption>Tasks by priority</figcaption>
          <app-chart
            [config]="priorityChart()"
            label="Tasks by priority (values listed below)"
            [height]="180"
          />
          <ul class="values" aria-label="Tasks by priority">
            @for (entry of byPriority(); track entry.label) {
              <li>
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
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
    .values {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .values strong {
      color: var(--mat-sys-on-surface);
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCharts {
  readonly indicators = input.required<TaskIndicators>();

  protected readonly byStatus = computed<Entry[]>(() =>
    TASK_STATUSES.map((status) => ({
      label: TASK_STATUS_LABELS[status],
      value: this.indicators().byStatus[status],
    })),
  );

  protected readonly byPriority = computed<Entry[]>(() =>
    TASK_PRIORITIES.map((priority) => ({
      label: TASK_PRIORITY_LABELS[priority],
      value: this.indicators().byPriority[priority],
    })),
  );

  protected readonly statusChart = computed(() => barChart(this.byStatus()));
  protected readonly priorityChart = computed(() => barChart(this.byPriority()));
}
