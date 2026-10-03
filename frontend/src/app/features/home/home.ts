import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { APP_NAME } from '../../core/app.constants';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models/api-error';
import { ROLE_LABELS } from '../../core/models/user';
import {
  AiStatus,
  ServiceState,
  SystemStatus,
  llmProviderLabel,
} from '../../core/models/system-status';
import { HealthService } from '../../core/services/health.service';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { LoadingState } from '../../shared/components/loading-state/loading-state';

interface StatusRow {
  label: string;
  detail: string;
  state: ServiceState;
}

/**
 * Landing page. Shows whether the whole chain works: Angular → Express API → MongoDB.
 * (Replaced by the dashboard once authentication and the dashboard UI exist.)
 */
@Component({
  selector: 'app-home',
  imports: [DatePipe, MatCardModule, MatIconModule, MatButtonModule, LoadingState, ErrorState],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly healthService = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly appName = APP_NAME;
  protected readonly user = inject(AuthService).currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });
  protected readonly loading = signal(true);
  protected readonly status = signal<SystemStatus | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly aiStatus = signal<AiStatus | null>(null);

  constructor() {
    this.refresh();
  }

  protected rows(status: SystemStatus): StatusRow[] {
    const rows: StatusRow[] = [
      { label: 'Frontend', detail: 'Angular application', state: 'up' },
      { label: 'Backend API', detail: 'Node.js + Express.js', state: status.backend },
      { label: 'Database', detail: 'MongoDB', state: status.database },
    ];
    const ai = this.aiStatus();
    if (ai)
      rows.push({ label: 'AI service', detail: aiDetail(ai), state: ai.available ? 'up' : 'down' });
    return rows;
  }

  protected refresh(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    // Optional service: its failure never hides the status of the others.
    this.healthService
      .checkAi()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.aiStatus.set(status),
        error: () => this.aiStatus.set({ available: false, reason: 'UNREACHABLE', llm: null }),
      });

    this.healthService
      .check()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.status.set(status);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.status.set(null);
          this.errorMessage.set(
            error instanceof ApiError ? error.message : 'An unexpected error occurred.',
          );
          this.loading.set(false);
        },
      });
  }
}

/** "Python + FastAPI · Google Gemini gemini-…", "· local analyzer (no LLM key)", or why it is down. */
function aiDetail(status: AiStatus): string {
  if (!status.available) {
    return status.reason === 'NOT_CONFIGURED'
      ? 'Python + FastAPI · not configured (AI_SERVICE_TOKEN)'
      : 'Python + FastAPI · not running';
  }
  const llm = status.llm;
  return llm?.configured
    ? `Python + FastAPI · ${llmProviderLabel(llm.provider)} ${llm.model ?? ''}`.trim()
    : 'Python + FastAPI · local analyzer (no LLM key)';
}
