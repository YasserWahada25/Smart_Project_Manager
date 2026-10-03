import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/api-error.interceptor';
import { AppNotification, NotificationPage } from '../models/notification';

/**
 * Notifications of the signed-in user. Keeps the number of unread notifications in a signal
 * (toolbar badge), refreshed by polling (MainLayout) and after each change made here.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notifications`;

  readonly unreadCount = signal(0);

  /** Newest first; `unread` keeps only the unread ones. */
  list(page: number, limit: number, unread = false): Observable<NotificationPage> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (unread) params = params.set('unread', 'true');
    return this.http
      .get<NotificationPage>(this.url, { params })
      .pipe(tap((result) => this.unreadCount.set(result.unreadCount)));
  }

  /** Background refresh of the badge: failures are not shown (no toast). */
  refreshUnreadCount(): Observable<number> {
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    return this.http.get<{ unreadCount: number }>(`${this.url}/unread-count`, { context }).pipe(
      map(({ unreadCount }) => unreadCount),
      tap((count) => this.unreadCount.set(count)),
    );
  }

  markRead(notification: AppNotification): Observable<AppNotification> {
    return this.http
      .patch<{ notification: AppNotification }>(`${this.url}/${notification.id}/read`, {})
      .pipe(
        map((result) => result.notification),
        tap(() => {
          if (!notification.read) this.decrement();
        }),
      );
  }

  markAllRead(): Observable<number> {
    return this.http.patch<{ updated: number }>(`${this.url}/read-all`, {}).pipe(
      map(({ updated }) => updated),
      tap(() => this.unreadCount.set(0)),
    );
  }

  delete(notification: AppNotification): Observable<void> {
    return this.http.delete<void>(`${this.url}/${notification.id}`).pipe(
      tap(() => {
        if (!notification.read) this.decrement();
      }),
    );
  }

  private decrement(): void {
    this.unreadCount.update((count) => Math.max(count - 1, 0));
  }
}
