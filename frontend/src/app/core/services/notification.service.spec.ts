import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiErrorInterceptor } from '../http/api-error.interceptor';
import { AppNotification } from '../models/notification';
import { NotificationService } from './notification.service';
import { ToastService } from './toast.service';

describe('NotificationService', () => {
  let httpTesting: HttpTestingController;
  let service: NotificationService;
  let toastError: ReturnType<typeof vi.fn>;

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

  beforeEach(() => {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => httpTesting.verify());

  it('lists the notifications and keeps the unread count', () => {
    service.list(1, 20, true).subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/notifications');
    expect(request.request.params.toString()).toBe('page=1&limit=20&unread=true');
    request.flush({
      data: [notification()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      unreadCount: 4,
    });

    expect(service.unreadCount()).toBe(4);
  });

  it('refreshes the badge silently (no toast when the server is down)', () => {
    service.refreshUnreadCount().subscribe();
    httpTesting.expectOne('/api/v1/notifications/unread-count').flush({ unreadCount: 2 });
    expect(service.unreadCount()).toBe(2);

    service.refreshUnreadCount().subscribe({ error: () => undefined });
    httpTesting
      .expectOne('/api/v1/notifications/unread-count')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('marks as read and deletes, updating the count only for unread ones', () => {
    service.unreadCount.set(3);

    service.markRead(notification()).subscribe();
    const read = httpTesting.expectOne('/api/v1/notifications/n1/read');
    expect(read.request.method).toBe('PATCH');
    read.flush({ notification: notification({ read: true }) });
    expect(service.unreadCount()).toBe(2);

    service.delete(notification({ id: 'n2', read: true })).subscribe();
    httpTesting
      .expectOne('/api/v1/notifications/n2')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(service.unreadCount()).toBe(2);

    service.delete(notification({ id: 'n3' })).subscribe();
    httpTesting
      .expectOne('/api/v1/notifications/n3')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(service.unreadCount()).toBe(1);
  });

  it('marks everything as read', () => {
    service.unreadCount.set(3);
    let updated: number | undefined;

    service.markAllRead().subscribe((count) => (updated = count));
    httpTesting.expectOne('/api/v1/notifications/read-all').flush({ updated: 3 });

    expect(updated).toBe(3);
    expect(service.unreadCount()).toBe(0);
  });
});
