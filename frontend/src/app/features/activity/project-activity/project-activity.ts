import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { ACTIVITY_TYPE_LABELS, Activity, ActivityType } from '../../../core/models/activity';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadMoreList } from '../../../shared/data/load-more-list';
import { ProjectContext } from '../../projects/project-context';
import { ActivityService } from '../activity.service';
import { ActivityList } from '../activity-list/activity-list';

const PAGE_SIZE = 20;

/** "Activity" tab of a project: everything that happened in it, newest first. */
@Component({
  selector: 'app-project-activity',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressBarModule,
    ActivityList,
    ErrorState,
  ],
  template: `
    <div class="toolbar">
      <h2>Activity</h2>
      <mat-form-field appearance="outline" class="type" subscriptSizing="dynamic">
        <mat-label>Event</mat-label>
        <mat-select [formControl]="type">
          <mat-option value="">All events</mat-option>
          @for (option of types; track option) {
            <mat-option [value]="option">{{ typeLabels[option] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (list.errorMessage(); as message) {
      <app-error-state [message]="message" (retry)="list.reset()" />
    } @else {
      @if (list.loading() && list.items().length === 0) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the activity" />
      }
      <app-activity-list [activities]="list.items()" />
      @if (!list.loading() && list.items().length === 0) {
        <p class="empty">Nothing has happened yet{{ type.value ? ' for this event' : '' }}.</p>
      }
      @if (list.hasMore()) {
        <button
          mat-stroked-button
          type="button"
          class="more"
          [disabled]="list.loading()"
          (click)="list.loadMore()"
        >
          Show older entries
        </button>
      }
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    h2 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }
    .type {
      width: 260px;
      max-width: 100%;
    }
    .empty {
      padding: 24px 0;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .more {
      margin-top: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectActivity {
  private readonly context = inject(ProjectContext);
  private readonly activityService = inject(ActivityService);

  protected readonly typeLabels = ACTIVITY_TYPE_LABELS;
  protected readonly types = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
  protected readonly type = new FormControl<ActivityType | ''>('', { nonNullable: true });
  protected readonly list = new LoadMoreList<Activity>(
    (page) =>
      this.activityService.forProject(
        this.context.current.id,
        page,
        PAGE_SIZE,
        this.type.value || undefined,
      ),
    inject(DestroyRef),
  );

  constructor() {
    this.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.reset());
    this.list.reset();
  }
}
