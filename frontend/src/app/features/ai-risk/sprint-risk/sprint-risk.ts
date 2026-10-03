import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap, tap } from 'rxjs';

import { RISK_LEVEL_LABELS, SprintRisk } from '../../../core/models/ai-risk';
import { ApiError } from '../../../core/models/api-error';
import { AiRiskService } from '../ai-risk.service';

/**
 * AI-03 indicator: "Delay risk: High (82 %)" with the main factors. Loaded on display (the risk
 * changes every day); an unavailable AI service only shows a discreet line.
 */
@Component({
  selector: 'app-sprint-risk',
  imports: [PercentPipe, MatIconModule],
  template: `
    <div class="risk" role="status" aria-live="polite">
      @if (risk(); as current) {
        <p class="level" [attr.data-level]="current.riskLevel">
          <mat-icon aria-hidden="true">{{ icons[current.riskLevel] }}</mat-icon>
          <span>
            Delay risk (AI): <strong>{{ labels[current.riskLevel] }}</strong> ({{
              current.probability | percent: '1.0-0'
            }})
          </span>
        </p>
        @if (current.factors.length > 0) {
          <ul class="factors">
            @for (factor of current.factors; track factor.code) {
              <li>{{ factor.label }}</li>
            }
          </ul>
        }
        @for (warning of current.warnings; track $index) {
          <p class="note">{{ warning }}</p>
        }
      } @else if (unavailable(); as message) {
        <p class="note">Delay risk unavailable: {{ message }}</p>
      } @else {
        <p class="note">Estimating the delay risk…</p>
      }
    </div>
  `,
  styles: `
    .risk {
      margin-top: 8px;
    }
    .level {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 2px 10px 2px 6px;
      border-radius: 8px;
      font: var(--mat-sys-label-large);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .level[data-level='MEDIUM'] {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .level[data-level='HIGH'] {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    .factors {
      margin: 6px 0 0;
      padding-left: 20px;
      font: var(--mat-sys-body-small);
    }
    .note {
      margin: 4px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintRiskIndicator {
  readonly sprintId = input.required<string>();

  private readonly riskService = inject(AiRiskService);

  protected readonly labels = RISK_LEVEL_LABELS;
  protected readonly icons = { LOW: 'check_circle', MEDIUM: 'warning', HIGH: 'error' } as const;
  protected readonly risk = signal<SprintRisk | null>(null);
  protected readonly unavailable = signal<string | null>(null);

  constructor() {
    toObservable(this.sprintId)
      .pipe(
        tap(() => {
          this.risk.set(null);
          this.unavailable.set(null);
        }),
        switchMap((id) =>
          this.riskService.risk(id).pipe(
            catchError((error: unknown) => {
              this.unavailable.set(
                error instanceof ApiError ? error.message : 'An unexpected error occurred.',
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((risk) => this.risk.set(risk));
  }
}
