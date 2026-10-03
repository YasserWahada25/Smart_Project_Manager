import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../core/models/api-error';
import { Paginated } from '../../core/models/pagination';
import { actionErrorMessage } from '../../core/http/action-error';
import { PagedList } from './paged-list';

interface Item {
  id: string;
  name: string;
}

const page = (data: Item[], total = data.length): Paginated<Item> => ({
  data,
  pagination: { page: 1, limit: 10, total, totalPages: 1 },
});

describe('PagedList', () => {
  const create = (fetch: (query: string) => Observable<Paginated<Item>>) =>
    TestBed.runInInjectionContext(
      () => new PagedList<string, Item>(fetch, TestBed.inject(DestroyRef)),
    );

  it('loads a page: items, total and loading flag', () => {
    const response = new Subject<Paginated<Item>>();
    const list = create(() => response);

    list.load('q');
    expect(list.loading()).toBe(true);

    response.next(page([{ id: '1', name: 'A' }], 21));
    expect(list.loading()).toBe(false);
    expect(list.items()).toEqual([{ id: '1', name: 'A' }]);
    expect(list.total()).toBe(21);
  });

  it('only displays the response of the latest query', () => {
    const slow = new Subject<Paginated<Item>>();
    const list = create((query) => (query === 'slow' ? slow : of(page([{ id: '2', name: 'B' }]))));

    list.load('slow');
    list.load('fast');
    slow.next(page([{ id: '1', name: 'outdated' }]));

    expect(list.items()).toEqual([{ id: '2', name: 'B' }]);
  });

  it('exposes the error message and recovers on the next load', () => {
    let fail = true;
    const list = create(() =>
      fail
        ? throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'))
        : of(page([])),
    );

    list.load('q');
    expect(list.errorMessage()).toBe('Cannot reach the server.');
    expect(list.loading()).toBe(false);

    fail = false;
    list.load('q');
    expect(list.errorMessage()).toBeNull();
  });

  it('replaces an item in place', () => {
    const list = create(() =>
      of(
        page([
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ]),
      ),
    );
    list.load('q');

    list.replace({ id: '2', name: 'B2' });

    expect(list.items().map((item) => item.name)).toEqual(['A', 'B2']);
  });
});

describe('actionErrorMessage', () => {
  it.each([
    [new ApiError(409, 'CONFLICT', 'Already a member'), 'Already a member'],
    [new ApiError(403, 'FORBIDDEN', 'Not allowed'), 'Not allowed'],
    [new ApiError(0, 'NETWORK_ERROR', 'offline'), null],
    [new ApiError(500, 'INTERNAL', 'boom'), null],
    [new ApiError(401, 'UNAUTHORIZED', 'expired'), null],
    [new Error('bug'), 'An unexpected error occurred.'],
  ])('%s → %p (network, 5xx and 401 are reported globally)', (error, expected) => {
    expect(actionErrorMessage(error)).toBe(expected);
  });
});
