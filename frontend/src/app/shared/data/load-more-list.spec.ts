import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { Paginated } from '../../core/models/pagination';
import { LoadMoreList } from './load-more-list';

interface Item {
  id: string;
}

const page = (ids: string[], total: number): Paginated<Item> => ({
  data: ids.map((id) => ({ id })),
  pagination: { page: 1, limit: 2, total, totalPages: Math.ceil(total / 2) },
});

describe('LoadMoreList', () => {
  const create = (fetch: (page: number) => Observable<Paginated<Item>>) =>
    TestBed.runInInjectionContext(() => new LoadMoreList<Item>(fetch, TestBed.inject(DestroyRef)));

  it('appends the next pages until everything is loaded', () => {
    const fetch = vi.fn((n: number) => of(n === 1 ? page(['a', 'b'], 3) : page(['c'], 3)));
    const list = create(fetch);

    list.reset();
    expect(list.items().map((item) => item.id)).toEqual(['a', 'b']);
    expect(list.hasMore()).toBe(true);

    list.loadMore();
    expect(fetch).toHaveBeenLastCalledWith(2);
    expect(list.items().map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(list.hasMore()).toBe(false);
  });

  it('ignores a response requested before a reset', () => {
    const slow = new Subject<Paginated<Item>>();
    let first = true;
    const list = create(() => {
      if (first) {
        first = false;
        return slow;
      }
      return of(page(['new'], 1));
    });

    list.reset();
    list.reset();
    slow.next(page(['old'], 1));

    expect(list.items().map((item) => item.id)).toEqual(['new']);
  });

  it('replaces and removes items, and reports errors', () => {
    let fail = false;
    const list = create(() =>
      fail
        ? throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Offline'))
        : of(page(['a', 'b'], 2)),
    );
    list.reset();

    list.remove('a');
    expect(list.items()).toEqual([{ id: 'b' }]);
    expect(list.total()).toBe(1);

    fail = true;
    list.reset();
    expect(list.errorMessage()).toBe('Offline');
    expect(list.loading()).toBe(false);
  });
});
