import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { actionErrorMessage } from '../../../core/http/action-error';
import { ApiError } from '../../../core/models/api-error';
import {
  DeveloperRecommendation,
  RecommendationResult,
} from '../../../core/models/ai-recommendation';
import { Task } from '../../../core/models/task';
import { fullName } from '../../../core/models/user';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { TaskService } from '../../tasks/task.service';
import { AiRecommendationService } from '../ai-recommendation.service';

export interface RecommendDialogData {
  taskId: string;
  taskTitle: string;
}

/**
 * AI-02: the developers of the project ranked for a task, with the reasons of their score; the
 * manager assigns one in a click. Closes with the updated task once assigned.
 */
@Component({
  selector: 'app-recommend-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    LoadingState,
    ErrorState,
  ],
  template: `
    <h2 mat-dialog-title>Recommended developers</h2>
    <mat-dialog-content>
      <p class="subtitle">For «{{ data.taskTitle }}»</p>
      @if (loading()) {
        <app-loading-state message="Ranking the team…" />
      } @else if (errorMessage(); as message) {
        <app-error-state [message]="message" (retry)="load()" />
      } @else if (result(); as current) {
        <p class="method">
          Score = 60 % skills + 25 % workload + 15 % experience.
          @if (current.skills.length > 0) {
            Skills compared: {{ current.skills.join(', ') }}.
          }
        </p>
        @for (warning of current.warnings; track $index) {
          <p class="warning" role="status">
            <mat-icon aria-hidden="true">info</mat-icon>
            <span>{{ warning }}</span>
          </p>
        }
        <ol class="ranking">
          @for (item of current.recommendations; track item.developer.id; let rank = $index) {
            <li class="candidate">
              <div class="head">
                <span class="rank" aria-hidden="true">{{ rank + 1 }}</span>
                <div class="who">
                  <strong>{{ name(item) }}</strong>
                  @if (item.developer.jobTitle) {
                    <span class="muted">{{ item.developer.jobTitle }}</span>
                  }
                </div>
                <span class="score">{{ item.score }}<span class="muted"> / 100</span></span>
              </div>
              <mat-progress-bar
                mode="determinate"
                [value]="item.score"
                [attr.aria-label]="'Score of ' + name(item)"
              />
              <ul class="skills" aria-label="Skills">
                @for (skill of item.matchingSkills; track skill) {
                  <li class="match">{{ skill }}</li>
                }
                @for (skill of item.missingSkills; track skill) {
                  <li class="missing">missing: {{ skill }}</li>
                }
              </ul>
              <p class="explanation">{{ item.explanation }}</p>
              <div class="actions">
                @if (item.isAssignee) {
                  <span class="muted">Current assignee</span>
                } @else {
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="assigning() !== null"
                    [attr.aria-label]="'Assign to ' + name(item)"
                    (click)="assign(item)"
                  >
                    <mat-icon>assignment_ind</mat-icon>
                    Assign
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="muted">No developer to recommend.</li>
          }
        </ol>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle,
    .method {
      margin: 0 0 12px;
    }
    .method,
    .muted {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .warning {
      display: flex;
      gap: 8px;
      margin: 0 0 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .ranking {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .candidate {
      padding: 12px 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .rank {
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-primary);
    }
    .who {
      display: flex;
      flex: 1;
      flex-direction: column;
    }
    .score {
      font: var(--mat-sys-title-medium);
    }
    .skills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }
    .skills li {
      padding: 2px 8px;
      border-radius: 8px;
      font: var(--mat-sys-label-medium);
    }
    .match {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .missing {
      border: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
    }
    .explanation {
      margin: 8px 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendDialog {
  protected readonly data = inject<RecommendDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RecommendDialog, Task>>(MatDialogRef);
  private readonly recommendationService = inject(AiRecommendationService);
  private readonly taskService = inject(TaskService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<RecommendationResult | null>(null);
  /** Developer being assigned. */
  protected readonly assigning = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected name(item: DeveloperRecommendation): string {
    return fullName(item.developer);
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.recommendationService
      .recommend(this.data.taskId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
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

  protected assign(item: DeveloperRecommendation): void {
    this.assigning.set(item.developer.id);
    this.taskService
      .setAssignee(this.data.taskId, item.developer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (task) => this.dialogRef.close(task),
        error: (error: unknown) => {
          this.assigning.set(null);
          const message = actionErrorMessage(error);
          if (message) this.toast.error(message);
        },
      });
  }
}
