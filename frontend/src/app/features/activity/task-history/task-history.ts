import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { Activity } from '../../../core/models/activity';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadMoreList } from '../../../shared/data/load-more-list';
import { ActivityService } from '../activity.service';
import { ActivityList } from '../activity-list/activity-list';

const PAGE_SIZE = 10;

/** History of one task (task page), newest first. */
@Component({
  selector: 'app-task-history',
  imports: [MatButtonModule, ActivityList, ErrorState],
  template: `
    @if (list.errorMessage(); as message) {
      <app-error-state [message]="message" (retry)="list.reset()" />
    } @else {
      <app-activity-list [activities]="list.items()" />
      @if (!list.loading() && list.items().length === 0) {
        <p class="empty">No history yet.</p>
      }
      @if (list.hasMore()) {
        <button mat-button type="button" [disabled]="list.loading()" (click)="list.loadMore()">
          Show older entries
        </button>
      }
    }
  `,
  styles: `
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskHistory {
  readonly taskId = input.required<string>();
  /** Incremented by the task page after a change, to reload the history. */
  readonly version = input(0);

  private readonly activityService = inject(ActivityService);

  protected readonly list = new LoadMoreList<Activity>(
    (page) => this.activityService.forTask(this.taskId(), page, PAGE_SIZE),
    inject(DestroyRef),
  );

  constructor() {
    effect(() => {
      this.taskId();
      this.version();
      untracked(() => this.list.reset());
    });
  }
}
