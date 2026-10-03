import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppNotification } from '../../../core/models/notification';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { NotificationList } from './notification-list';

describe('NotificationList', () => {
  let fixture: ComponentFixture<NotificationList>;
  let service: {
    unreadCount: ReturnType<typeof signal<number>>;
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
    id: 'n1',
    type: 'TASK_ASSIGNED',
    message: 'Sara Manager assigned you the task «Login»',
    actor: { id: 'u1', firstName: 'Sara', lastName: 'Manager' },
    project: 'p1',
    task: 't1',
    read: false,
    createdAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  });
  const items = [
    notification(),
    notification({
      id: 'n2',
      type: 'ADDED_TO_PROJECT',
      message: 'Sara Manager added you to the project «Shop»',
      task: undefined,
      read: true,
    }),
    notification({ id: 'n3', type: 'REMOVED_FROM_PROJECT', message: 'removed', task: undefined }),
  ];

  beforeEach(async () => {
    service = {
      unreadCount: signal(2),
      list: vi.fn(() =>
        of({
          data: items,
          pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          unreadCount: 2,
        }),
      ),
      markRead: vi.fn((n: AppNotification) => of({ ...n, read: true })),
      markAllRead: vi.fn(() => of(2)),
      delete: vi.fn(() => of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [NotificationList],
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(NotificationList);
    await fixture.whenStable();
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...element().querySelectorAll('li.notification')];
  const openButton = (index: number) =>
    rows()[index].querySelector<HTMLButtonElement>('button.open')!;

  it('lists the notifications, unread ones highlighted', () => {
    expect(service.list).toHaveBeenCalledWith(1, 20, false);
    expect(element().textContent).toContain('2 unread notifications');
    expect(rows()).toHaveLength(3);
    expect(rows()[0].classList).toContain('unread');
    expect(rows()[1].classList).not.toContain('unread');
    expect(rows()[0].textContent).toContain('Sara Manager assigned you the task «Login»');
  });

  it('opening a notification marks it as read and goes to its task or project', async () => {
    openButton(0).click();
    await fixture.whenStable();
    expect(service.markRead).toHaveBeenCalledWith(items[0]);
    expect(navigate).toHaveBeenLastCalledWith(['/projects', 'p1', 'tasks', 't1']);
    expect(rows()[0].classList).not.toContain('unread');

    openButton(1).click();
    await fixture.whenStable();
    expect(service.markRead).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith(['/projects', 'p1']);

    // A removed member cannot open the project any more: only marked as read.
    navigate.mockClear();
    openButton(2).click();
    await fixture.whenStable();
    expect(service.markRead).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('marks everything as read and deletes a notification', async () => {
    [...element().querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Mark all as read'))!
      .click();
    await fixture.whenStable();
    expect(service.markAllRead).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('2 notifications marked as read.');
    expect(element().querySelectorAll('li.unread')).toHaveLength(0);

    rows()[0].querySelector<HTMLButtonElement>('[aria-label="Delete the notification"]')!.click();
    await fixture.whenStable();
    expect(service.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    expect(rows()).toHaveLength(2);
  });

  it('shows only the unread ones on demand', async () => {
    element().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();

    expect(service.list).toHaveBeenLastCalledWith(1, 20, true);
  });
});
