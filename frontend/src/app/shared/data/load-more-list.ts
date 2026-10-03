import { DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { Paginated } from '../../core/models/pagination';

/**
 * Feed loaded page by page with a "Load more" button (comments, history, notifications).
 * `reset()` starts again from the first page; a response to a request made before the last
 * reset is ignored, so an old page can never be mixed with the new list.
 */
export class LoadMoreList<T extends { id: string }> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasMore = computed(() => this.items().length < this.total());

  private page = 0;
  private generation = 0;

  constructor(
    private readonly fetch: (page: number) => Observable<Paginated<T>>,
    private readonly destroyRef: DestroyRef,
  ) {}

  reset(): void {
    this.generation++;
    this.page = 0;
    this.items.set([]);
    this.total.set(0);
    this.loadMore();
  }

  loadMore(): void {
    const generation = this.generation;
    const page = this.page + 1;
    this.loading.set(true);
    this.errorMessage.set(null);

    this.fetch(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.page = page;
          this.items.update((items) => (page === 1 ? result.data : [...items, ...result.data]));
          this.total.set(result.pagination.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.errorMessage.set(
            error instanceof ApiError ? error.message : 'An unexpected error occurred.',
          );
          this.loading.set(false);
        },
      });
  }

  /** Replaces an item after it was modified (matched by id). */
  replace(item: T): void {
    this.items.update((items) => items.map((current) => (current.id === item.id ? item : current)));
  }

  /** Removes an item after it was deleted. */
  remove(id: string): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
    this.total.update((total) => Math.max(total - 1, 0));
  }
}
