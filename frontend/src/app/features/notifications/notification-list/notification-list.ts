import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { EMPTY, Observable, catchError, of } from 'rxjs';

import { actionErrorMessage } from '../../../core/http/action-error';
import { AppNotification, NOTIFICATION_ICONS } from '../../../core/models/notification';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadMoreList } from '../../../shared/data/load-more-list';

const PAGE_SIZE = 20;

/**
 * Notifications of the signed-in user, newest first. Opening one marks it as read and goes
 * to the task or the project it is about.
 */
@Component({
  selector: 'app-notification-list',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule,
    ErrorState,
  ],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationList {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly unreadOnly = new FormControl(false, { nonNullable: true });
  protected readonly list = new LoadMoreList<AppNotification>(
    (page) => this.notifications.list(page, PAGE_SIZE, this.unreadOnly.value),
    this.destroyRef,
  );

  constructor() {
    this.unreadOnly.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.list.reset());
    this.list.reset();
  }

  /** A removed member can no longer open the project. */
  protected canOpen(notification: AppNotification): boolean {
    return notification.type !== 'REMOVED_FROM_PROJECT';
  }

  protected open(notification: AppNotification): void {
    const marked: Observable<unknown> = notification.read
      ? of(null)
      : this.notifications.markRead(notification).pipe(catchError(() => of(null)));
    marked.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!notification.read) this.list.replace({ ...notification, read: true });
      if (!this.canOpen(notification)) return;
      void this.router.navigate(
        notification.task
          ? ['/projects', notification.project, 'tasks', notification.task]
          : ['/projects', notification.project],
      );
    });
  }

  protected markAllRead(): void {
    this.notifications
      .markAllRead()
      .pipe(
        catchError((error: unknown) => this.report(error)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        if (this.unreadOnly.value) {
          this.list.reset();
        } else {
          this.list.items.update((items) => items.map((item) => ({ ...item, read: true })));
        }
        this.toast.success(
          `${updated} ${updated === 1 ? 'notification' : 'notifications'} marked as read.`,
        );
      });
  }

  protected remove(notification: AppNotification): void {
    this.notifications
      .delete(notification)
      .pipe(
        catchError((error: unknown) => this.report(error)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.list.remove(notification.id));
  }

  private report(error: unknown): Observable<never> {
    const message = actionErrorMessage(error);
    if (message) this.toast.error(message);
    return EMPTY;
  }
}
