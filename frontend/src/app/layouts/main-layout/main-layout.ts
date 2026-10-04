import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EMPTY, catchError, filter, map, startWith, switchMap, timer } from 'rxjs';

import { APP_NAME } from '../../core/app.constants';
import { AuthService } from '../../core/auth/auth.service';
import { Project } from '../../core/models/project';
import { ROLE_LABELS, Role } from '../../core/models/user';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { CommandPaletteService } from '../../features/command-palette/command-palette.service';
import { ProjectService } from '../../features/projects/project.service';
import { Avatar } from '../../shared/components/avatar/avatar';
import { identityColor, initials } from '../../shared/colors';

/** Refresh period of the unread notifications badge. */
export const NOTIFICATION_POLL_MS = 60_000;
/** Projects listed in the sidebar (the others are on the Projects page). */
export const SIDEBAR_PROJECTS = 8;
export const SIDEBAR_STORAGE_KEY = 'spm.sidebar';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Roles allowed to see the entry (all roles when absent). */
  roles?: readonly Role[];
  /** Shows the unread notifications count. */
  inbox?: boolean;
}

/** Main navigation (Linear-like). "My profile" is in the account menu at the bottom of the sidebar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', icon: 'home', path: '/' },
  { label: 'Inbox', icon: 'inbox', path: '/notifications', inbox: true },
  // Only developers can be assigned tasks (team members are DEVELOPER accounts).
  { label: 'My tasks', icon: 'task_alt', path: '/my-tasks', roles: ['DEVELOPER'] },
  { label: 'Dashboard', icon: 'insights', path: '/dashboard' },
  { label: 'Projects', icon: 'folder_open', path: '/projects' },
  { label: 'Users', icon: 'manage_accounts', path: '/admin/users', roles: ['ADMIN'] },
];

export const THEME_OPTIONS: readonly { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'system', label: 'System', icon: 'brightness_auto' },
  { mode: 'light', label: 'Light', icon: 'light_mode' },
  { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
];

/**
 * Application shell for authenticated users, inspired by Linear: a sidebar with the logo, the search
 * field, the navigation (with the unread count on Inbox), the user's projects and the account menu
 * (profile, theme, log out). On large screens it can be collapsed to icons; on handsets it is a drawer
 * opened from a slim top bar.
 */
@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    Avatar,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NotificationService);
  private readonly projectService = inject(ProjectService);
  private readonly document = inject(DOCUMENT);
  protected readonly theme = inject(ThemeService);

  private readonly palette = inject(CommandPaletteService);

  protected readonly appName = APP_NAME;
  protected readonly themeOptions = THEME_OPTIONS;
  /** Entries the signed-in user may open (the routes are also protected by roleGuard). */
  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );
  protected readonly user = this.auth.currentUser;
  protected readonly canCreateProject = computed(() => this.auth.hasRole('PROJECT_MANAGER'));
  protected readonly unreadCount = this.notifications.unreadCount;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Project of the current page (/projects/:id/…). */
  protected readonly currentProjectId = computed(
    () => /^\/projects\/([a-f\d]{24})/i.exec(this.currentUrl())?.[1] ?? null,
  );
  /** "Ask AI" (manager): the projects they manage, the current one first. */
  protected readonly askAiProjects = computed(() => {
    const userId = this.user()?.id;
    const current = this.currentProjectId();
    return this.projects()
      .filter((project) => project.manager.id === userId && project.status !== 'ARCHIVED')
      .sort((a, b) => Number(b.id === current) - Number(a.id === current));
  });
  protected readonly showAskAi = computed(
    () =>
      this.auth.hasRole('PROJECT_MANAGER') &&
      this.askAiProjects().length > 0 &&
      !this.currentUrl().endsWith('/assistant'),
  );
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly projects = signal<Project[]>([]);
  protected readonly projectsTotal = signal(0);

  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );
  /** Icons only: collapsed on large screens (the handset drawer always shows the labels). */
  protected readonly compact = computed(() => this.collapsed() && !this.isHandset());

  constructor() {
    // Unread notifications badge: refreshed now, then every minute while signed in.
    timer(0, NOTIFICATION_POLL_MS)
      .pipe(
        switchMap(() => this.notifications.refreshUnreadCount().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Sidebar projects: loaded now, and again after a visit to the project pages (create, delete…).
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd && event.urlAfterRedirects.startsWith('/projects'),
        ),
        startWith(null),
        switchMap(() =>
          this.projectService
            .list({ page: 1, limit: SIDEBAR_PROJECTS })
            .pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.projects.set(page.data);
        this.projectsTotal.set(page.pagination.total);
      });
  }

  protected projectColor(project: Project): string {
    return identityColor(project.id);
  }

  protected projectInitial(project: Project): string {
    return initials(project.name).slice(0, 1);
  }

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      this.document.defaultView?.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        next ? 'collapsed' : 'expanded',
      );
    } catch {
      // Storage unavailable: the choice lasts until the page is closed.
    }
  }

  protected askAi(project: Project): void {
    void this.router.navigate(['/projects', project.id, 'assistant']);
  }

  protected openPalette(): void {
    void this.palette.open();
  }

  /**
   * Keyboard shortcuts (Linear-like): Ctrl+K / Cmd+K opens the command palette from anywhere;
   * "/" too, unless the user is typing in a field.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openPalette();
      return;
    }
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.openPalette();
    }
  }

  protected logout(): void {
    this.auth.logout();
    this.toast.info('You have been logged out.');
    void this.router.navigateByUrl('/login');
  }

  private readCollapsed(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  }
}
