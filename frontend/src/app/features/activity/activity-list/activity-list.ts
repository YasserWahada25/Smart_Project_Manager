import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Activity, ActivityType, describeActivity } from '../../../core/models/activity';
import { fullName } from '../../../core/models/user';
import { Avatar } from '../../../shared/components/avatar/avatar';

const ICONS: Partial<Record<ActivityType, string>> = {
  PROJECT_CREATED: 'add_circle',
  MEMBER_ADDED: 'group_add',
  MEMBER_REMOVED: 'group_remove',
  SPRINT_CREATED: 'add_circle',
  SPRINT_STATUS_CHANGED: 'flag',
  TASK_CREATED: 'add_task',
  TASK_ASSIGNED: 'assignment_ind',
  TASK_UNASSIGNED: 'assignment_return',
  TASK_STATUS_CHANGED: 'swap_horiz',
  TASK_DELETED: 'delete',
  SPRINT_DELETED: 'delete',
  COMMENT_ADDED: 'comment',
  AI_PLAN_APPLIED: 'auto_awesome',
};

/** Timeline of activity entries: "<actor> <what happened> — <date>". */
@Component({
  selector: 'app-activity-list',
  imports: [Avatar, DatePipe, MatIconModule],
  template: `
    <ol class="timeline">
      @for (activity of activities(); track activity.id) {
        <li>
          <mat-icon aria-hidden="true">{{ icon(activity) }}</mat-icon>
          <div class="text">
            <p>
              <app-avatar class="actor" [person]="activity.actor" size="small" />
              <strong>{{ fullName(activity.actor) }}</strong> {{ describe(activity) }}
            </p>
            <time [attr.datetime]="activity.createdAt">{{
              activity.createdAt | date: 'medium'
            }}</time>
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    mat-icon {
      flex: none;
      color: var(--mat-sys-primary);
    }
    .actor {
      vertical-align: middle;
      margin-right: 6px;
    }
    p {
      margin: 0;
      overflow-wrap: anywhere;
    }
    time {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityList {
  readonly activities = input.required<Activity[]>();

  protected readonly fullName = fullName;
  protected readonly describe = describeActivity;

  protected icon(activity: Activity): string {
    return ICONS[activity.type] ?? 'edit';
  }
}
