import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { WorkloadRow } from '../../../core/models/dashboard';
import { fullName } from '../../../core/models/user';

/** Open work per person (tasks not DONE), with a bar proportional to the open story points. */
@Component({
  selector: 'app-workload-table',
  template: `
    @if (rows().length === 0) {
      <p class="empty">No open task assigned.</p>
    } @else {
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Developer</th>
              <th scope="col">Open points</th>
              <th scope="col" class="number">Open tasks</th>
              <th scope="col" class="number">In progress</th>
              <th scope="col" class="number">Blocked</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.user.id) {
              <tr>
                <th scope="row">{{ fullName(row.user) }}</th>
                <td class="points">
                  <span class="bar" [style.width.%]="share(row)"></span>
                  <span>{{ row.openPoints }}</span>
                </td>
                <td class="number">{{ row.openTasks }}</td>
                <td class="number">{{ row.inProgressTasks }}</td>
                <td class="number" [class.alert]="row.blockedTasks > 0">{{ row.blockedTasks }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      min-width: 520px;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    thead th {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    tbody th {
      font: var(--mat-sys-title-small);
    }
    .number {
      text-align: right;
    }
    .points {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 160px;
    }
    .bar {
      display: inline-block;
      height: 10px;
      min-width: 2px;
      max-width: 120px;
      border-radius: 5px;
      background: var(--mat-sys-primary);
    }
    .alert {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkloadTable {
  readonly rows = input.required<WorkloadRow[]>();

  protected readonly fullName = fullName;
  private readonly maxPoints = computed(() =>
    Math.max(1, ...this.rows().map((row) => row.openPoints)),
  );

  /** Width of the bar, relative to the heaviest workload. */
  protected share(row: WorkloadRow): number {
    return Math.round((row.openPoints / this.maxPoints()) * 100);
  }
}
