import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../../core/models/api-error';
import { SearchResults } from '../../../core/models/dashboard';
import { PROJECT_STATUS_LABELS } from '../../../core/models/project';
import { fullName } from '../../../core/models/user';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { DashboardService } from '../../dashboard/dashboard.service';
import { TaskPriorityBadge, TaskStatusBadge } from '../../tasks/task-badges';

/** Results per type (backend: 1–20). */
const RESULTS_PER_TYPE = 10;
const MIN_LENGTH = 2;

type SearchOutcome = { ok: true; results: SearchResults | null } | { ok: false; message: string };

/**
 * Global search (`/search?q=…`) in the projects the user can see: project name and
 * description, task title and description. The query is kept in the URL.
 */
@Component({
  selector: 'app-search-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    ErrorState,
    TaskStatusBadge,
    TaskPriorityBadge,
  ],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
  /** Query parameter `q` (bound by the router). */
  readonly q = input<string>();

  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  protected readonly minLength = MIN_LENGTH;
  protected readonly projectStatusLabels = PROJECT_STATUS_LABELS;
  protected readonly fullName = fullName;
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly results = signal<SearchResults | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly searches = new Subject<string>();

  constructor() {
    this.searches
      .pipe(
        tap(() => this.errorMessage.set(null)),
        switchMap((q) => {
          if (q.length < MIN_LENGTH) return of<SearchOutcome>({ ok: true, results: null });
          this.loading.set(true);
          return this.dashboardService.search(q, RESULTS_PER_TYPE).pipe(
            map((results): SearchOutcome => ({ ok: true, results })),
            catchError((error: unknown) =>
              of<SearchOutcome>({
                ok: false,
                message: error instanceof ApiError ? error.message : 'An unexpected error occurred.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        if (outcome.ok) this.results.set(outcome.results);
        else this.errorMessage.set(outcome.message);
        this.loading.set(false);
      });

    // The URL is the source of truth: typing updates ?q=, and ?q= runs the search.
    effect(() => {
      const q = (this.q() ?? '').trim();
      untracked(() => {
        if (this.query.value.trim() !== q) this.query.setValue(q, { emitEvent: false });
        this.searches.next(q);
      });
    });
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.updateUrl(value));
  }

  protected retry(): void {
    this.searches.next(this.query.value.trim());
  }

  private updateUrl(value: string): void {
    const q = value.trim();
    void this.router.navigate(['/search'], {
      queryParams: q ? { q } : {},
      replaceUrl: true,
    });
  }
}
