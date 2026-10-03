import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EMPTY, catchError, map, switchMap, timer } from 'rxjs';

import { APP_NAME } from '../../core/app.constants';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS, Role } from '../../core/models/user';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';

/** Refresh period of the unread notifications badge. */
export const NOTIFICATION_POLL_MS = 60_000;

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Roles allowed to see the entry (all roles when absent). */
  roles?: readonly Role[];
}

/** Navigation entries: one per implemented feature page (extended as features are added). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', icon: 'home', path: '/' },
  { label: 'Projects', icon: 'folder', path: '/projects' },
  // Only developers can be assigned tasks (team members are DEVELOPER accounts).
  { label: 'My tasks', icon: 'task_alt', path: '/my-tasks', roles: ['DEVELOPER'] },
  { label: 'My profile', icon: 'person', path: '/profile' },
  { label: 'Users', icon: 'manage_accounts', path: '/admin/users', roles: ['ADMIN'] },
];

/**
 * Application shell for authenticated users: toolbar (with user menu) + side navigation +
 * routed page. The side menu is always visible on large screens and becomes a drawer on handsets.
 */
@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NotificationService);

  protected readonly appName = APP_NAME;
  /** Entries the signed-in user may open (the routes are also protected by roleGuard). */
  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );
  protected readonly user = this.auth.currentUser;
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });

  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  constructor() {
    // Unread notifications badge: refreshed now, then every minute while signed in.
    timer(0, NOTIFICATION_POLL_MS)
      .pipe(
        switchMap(() => this.notifications.refreshUnreadCount().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected logout(): void {
    this.auth.logout();
    this.toast.info('You have been logged out.');
    void this.router.navigateByUrl('/login');
  }
}
