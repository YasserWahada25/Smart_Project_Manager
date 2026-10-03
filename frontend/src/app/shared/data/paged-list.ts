import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { Paginated } from '../../core/models/pagination';

type Outcome<T> = { ok: true; page: Paginated<T> } | { ok: false; error: unknown };

/**
 * State of a paginated list loaded from the backend (items, total, loading, error) for list
 * pages with filters. Only the response of the latest query is displayed (switchMap), so a
 * slow response can never overwrite a newer one.
 */
export class PagedList<Q, T extends { id: string }> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly queries = new Subject<Q>();

  constructor(fetch: (query: Q) => Observable<Paginated<T>>, destroyRef: DestroyRef) {
    this.queries
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((query) =>
          fetch(query).pipe(
            map((page): Outcome<T> => ({ ok: true, page })),
            catchError((error: unknown) => of<Outcome<T>>({ ok: false, error })),
          ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((outcome) => {
        if (outcome.ok) {
          this.items.set(outcome.page.data);
          this.total.set(outcome.page.pagination.total);
        } else {
          this.errorMessage.set(
            outcome.error instanceof ApiError
              ? outcome.error.message
              : 'An unexpected error occurred.',
          );
        }
        this.loading.set(false);
      });
  }

  load(query: Q): void {
    this.queries.next(query);
  }

  /** Replaces an item in place after it was modified (matched by id). */
  replace(item: T): void {
    this.items.update((items) => items.map((current) => (current.id === item.id ? item : current)));
  }
}
