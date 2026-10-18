import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { filter, of } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import {
  Retrospective,
  RetrospectiveAction,
  RetrospectiveResult,
} from '../../../core/models/ai-retrospective';
import { ApiError } from '../../../core/models/api-error';
import { TASK_PRIORITY_LABELS, TASK_TYPE_LABELS } from '../../../core/models/task';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { AiRetrospectiveService } from '../ai-retrospective.service';

export interface RetrospectiveDialogData {
  sprintId: string;
  sprintName: string;
  /** Manager of the project: generate, regenerate, create tasks from the actions. */
  canEdit: boolean;
  /** Generate at once when there is no retrospective yet (right after the sprint is completed). */
  generate?: boolean;
  /** Open sprints of the project, in chronological order: where a task can be created. */
  openSprints: { id: string; name: string; status: string }[];
}

interface Section {
  key: 'delivered' | 'slipped' | 'blockers' | 'wentWell' | 'toImprove';
  title: string;
  icon: string;
}

const SECTIONS: Section[] = [
  { key: 'delivered', title: 'Delivered', icon: 'task_alt' },
  { key: 'slipped', title: 'Not finished', icon: 'schedule' },
  { key: 'blockers', title: 'What slowed the team down', icon: 'block' },
  { key: 'wentWell', title: 'What went well', icon: 'thumb_up' },
  { key: 'toImprove', title: 'What to improve', icon: 'trending_up' },
];

/**
 * AI-05: retrospective of a completed sprint — figures computed from the tasks, a summary and sections
 * written by the AI (or built from the figures without a language model), and actions the manager can turn
 * into tasks of the next sprint or of the backlog.
 */
@Component({
  selector: 'app-retrospective-dialog',
  imports: [
    DatePipe,
    PercentPipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    LoadingState,
    ErrorState,
  ],
  templateUrl: './retrospective-dialog.html',
  styleUrl: './retrospective-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetrospectiveDialog {
  protected readonly data = inject<RetrospectiveDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(AiRetrospectiveService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sections = SECTIONS;
  protected readonly typeLabels = TASK_TYPE_LABELS;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly loading = signal(true);
  protected readonly generating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly retrospective = signal<Retrospective | null>(null);
  /** Action whose task is being created. */
  protected readonly creating = signal<string | null>(null);
  /** Destination chosen per action ('' = backlog). */
  private readonly targets = signal<Record<string, string>>({});
  /** The next planned sprint, else the active one, else the backlog. */
  private readonly defaultTarget =
    (
      this.data.openSprints.find((sprint) => sprint.status === 'PLANNED') ??
      this.data.openSprints[0]
    )?.id ?? '';
  private lastRequest: 'load' | 'generate' = 'load';

  constructor() {
    this.load();
  }

  protected load(): void {
    this.lastRequest = 'load';
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service
      .get(this.data.sprintId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ retrospective }) => {
          this.retrospective.set(retrospective);
          this.loading.set(false);
          if (!retrospective && this.data.generate && this.data.canEdit) this.run();
        },
        error: (error: unknown) => this.fail(error, () => this.loading.set(false)),
      });
  }

  protected retry(): void {
    if (this.lastRequest === 'generate') this.run();
    else this.load();
  }

  /** Regenerating replaces the text and the actions (tasks already created are kept): confirmed first. */
  protected generate(): void {
    const confirmed = this.retrospective()
      ? this.confirmService.confirm({
          title: 'Regenerate the retrospective?',
          message:
            'The current retrospective is replaced. Tasks already created from its actions are kept.',
          confirmLabel: 'Regenerate',
        })
      : of(true);
    confirmed
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.run());
  }

  private run(): void {
    this.lastRequest = 'generate';
    this.generating.set(true);
    this.errorMessage.set(null);
    this.service
      .generate(this.data.sprintId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ retrospective }: RetrospectiveResult) => {
          this.retrospective.set(retrospective);
          this.generating.set(false);
        },
        error: (error: unknown) => this.fail(error, () => this.generating.set(false)),
      });
  }

  protected source(retro: Retrospective): string {
    return retro.method === 'llm'
      ? `Written by AI${retro.model ? ` (${retro.model})` : ''} from the sprint figures`
      : 'Built from the sprint figures (no language model)';
  }

  protected target(action: RetrospectiveAction): string {
    return this.targets()[action.id] ?? this.defaultTarget;
  }

  protected setTarget(action: RetrospectiveAction, sprintId: string): void {
    this.targets.update((targets) => ({ ...targets, [action.id]: sprintId }));
  }

  protected createTask(action: RetrospectiveAction): void {
    const sprintId = this.target(action) || null;
    const destination = this.data.openSprints.find((sprint) => sprint.id === sprintId)?.name;
    this.creating.set(action.id);
    this.service
      .createTask(this.data.sprintId, action.id, sprintId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ task, retrospective }) => {
          this.retrospective.set(retrospective);
          this.creating.set(null);
          this.toast.success(
            `Task «${task.title}» created in ${destination ? `«${destination}»` : 'the backlog'}.`,
          );
        },
        error: (error: unknown) => {
          this.creating.set(null);
          const message = actionErrorMessage(error);
          if (message) this.toast.error(message);
        },
      });
  }

  private fail(error: unknown, done: () => void): void {
    this.errorMessage.set(
      error instanceof ApiError ? error.message : 'An unexpected error occurred.',
    );
    done();
  }
}
