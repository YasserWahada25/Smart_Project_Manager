import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { User } from './core/models/user';
import { AppTitleStrategy } from './core/routing/app-title.strategy';
import { HealthService } from './core/services/health.service';
import { NotificationService } from './core/services/notification.service';
import { ToastService } from './core/services/toast.service';
import { ActivityService } from './features/activity/activity.service';
import { CommentService } from './features/comments/comment.service';
import { DashboardService } from './features/dashboard/dashboard.service';
import { ProfileService } from './features/profile/profile.service';
import { ProjectService } from './features/projects/project.service';
import { SprintService } from './features/sprints/sprint.service';
import { TaskService } from './features/tasks/task.service';
import { UserAdminService } from './features/users/user-admin.service';
import {
  fakeAuthService,
  testPage,
  testProject,
  testSprint,
  testTask,
  testUser,
} from './testing/test-data';
import { testDashboard, testProjectDashboard } from './testing/dashboard-data';

describe('App routing', () => {
  let toastError: ReturnType<typeof vi.fn>;

  function setup(user: User | null) {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        // Same router features as app.config.ts (route parameters bound to component inputs).
        provideRouter(routes, withComponentInputBinding()),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: ToastService, useValue: { error: toastError, info: vi.fn() } },
        {
          provide: HealthService,
          useValue: {
            check: () => of({ backend: 'up', database: 'up', checkedAt: new Date() }),
            checkAi: () => of({ available: false, reason: 'NOT_CONFIGURED', llm: null }),
          },
        },
        { provide: ProfileService, useValue: { load: () => of(user) } },
        {
          provide: UserAdminService,
          useValue: {
            list: () =>
              of({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            list: () =>
              of({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } }),
            get: (id: string) => of(testProject({ id })),
          },
        },
        { provide: SprintService, useValue: { list: () => of([testSprint()]) } },
        { provide: CommentService, useValue: { list: () => of(testPage([])) } },
        {
          provide: DashboardService,
          useValue: {
            get: () => of(testDashboard()),
            forProject: () => of(testProjectDashboard()),
            search: () =>
              of({ query: 'x', projects: { total: 0, items: [] }, tasks: { total: 0, items: [] } }),
          },
        },
        {
          provide: ActivityService,
          useValue: { forProject: () => of(testPage([])), forTask: () => of(testPage([])) },
        },
        {
          provide: NotificationService,
          useValue: {
            unreadCount: signal(0),
            refreshUnreadCount: () => of(0),
            list: () => of({ ...testPage([]), unreadCount: 0 }),
          },
        },
        {
          provide: TaskService,
          useValue: {
            list: () => of(testPage([testTask()])),
            get: (id: string) => of(testTask({ id })),
            assigned: () => of(testPage([])),
            board: () =>
              of({
                project: { id: 'p1', name: 'E-commerce platform', status: 'ACTIVE' },
                sprint: null,
                scope: 'ALL',
                totalTasks: 0,
                columns: [],
              }),
          },
        },
      ],
    });
  }

  const url = () => TestBed.inject(Router).url;
  const title = () => TestBed.inject(Title).getTitle();

  describe('signed-in user', () => {
    beforeEach(() => setup(testUser()));

    it('renders the home page inside the main layout, with a page title', async () => {
      const harness = await RouterTestingHarness.create('/');

      expect(harness.routeNativeElement?.textContent).toContain('Welcome, Sara');
      expect(harness.routeNativeElement?.querySelector('mat-toolbar')).not.toBeNull();
      expect(title()).toBe('Home · Smart Project Manager');
    });

    it('shows the "page not found" page for unknown URLs', async () => {
      const harness = await RouterTestingHarness.create('/does/not/exist');

      expect(harness.routeNativeElement?.textContent).toContain('Page not found');
      expect(title()).toBe('Page not found · Smart Project Manager');
    });

    it('cannot open the login page (sent back home)', async () => {
      await RouterTestingHarness.create('/login');

      expect(url()).toBe('/');
    });

    it('opens its profile page', async () => {
      const harness = await RouterTestingHarness.create('/profile');

      expect(harness.routeNativeElement?.textContent).toContain('My profile');
      expect(title()).toBe('My profile · Smart Project Manager');
    });

    it('opens the projects, the creation form ("new" is not read as an id) and a project', async () => {
      const harness = await RouterTestingHarness.create('/projects');
      expect(title()).toBe('Projects · Smart Project Manager');
      const heading = () => harness.routeNativeElement?.querySelector('h1')?.textContent;

      await harness.navigateByUrl('/projects/new');
      expect(heading()).toBe('New project');
      expect(title()).toBe('New project · Smart Project Manager');

      await harness.navigateByUrl('/projects/p1');
      expect(heading()).toBe('E-commerce platform');
      expect(title()).toBe('Project · Smart Project Manager');
    });

    it('opens the tabs of a project and a task page inside the project shell', async () => {
      const harness = await RouterTestingHarness.create('/projects/p1/sprints');
      const page = () => harness.routeNativeElement!;
      expect(page().querySelector('h1')?.textContent).toBe('E-commerce platform');
      expect(page().querySelector('h2')?.textContent).toBe('Sprints');
      expect(title()).toBe('Sprints · Smart Project Manager');

      await harness.navigateByUrl('/projects/p1/tasks');
      expect(page().querySelector('h2')?.textContent).toBe('Tasks');
      expect(page().querySelector('a.title')?.getAttribute('href')).toBe('/projects/p1/tasks/t1');

      await harness.navigateByUrl('/projects/p1/tasks/t1');
      expect(page().querySelector('h2')?.textContent).toBe('Implement login page');
      expect(title()).toBe('Task · Smart Project Manager');

      await harness.navigateByUrl('/projects/p1/board');
      expect(page().querySelector('h2')?.textContent).toBe('Board');
      expect(title()).toBe('Board · Smart Project Manager');

      await harness.navigateByUrl('/projects/p1/activity');
      expect(page().querySelector('h2')?.textContent).toBe('Activity');
      expect(title()).toBe('Activity · Smart Project Manager');

      await harness.navigateByUrl('/projects/p1/dashboard');
      expect(page().querySelector('h2')?.textContent).toBe('Tasks');
      expect(title()).toBe('Project dashboard · Smart Project Manager');
    });

    it('opens the dashboard and the search (query read from the URL)', async () => {
      const harness = await RouterTestingHarness.create('/dashboard');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Dashboard');
      expect(title()).toBe('Dashboard · Smart Project Manager');

      await harness.navigateByUrl('/search?q=payment');
      expect(
        harness.routeNativeElement?.querySelector<HTMLInputElement>('app-search-page input')?.value,
      ).toBe('payment');
      expect(title()).toBe('Search · Smart Project Manager');
    });

    it('opens the notifications', async () => {
      const harness = await RouterTestingHarness.create('/notifications');

      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Notifications');
      expect(title()).toBe('Notifications · Smart Project Manager');
    });

    it('opens "My tasks"', async () => {
      const harness = await RouterTestingHarness.create('/my-tasks');

      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('My tasks');
      expect(title()).toBe('My tasks · Smart Project Manager');
    });

    it('cannot open the user administration without the ADMIN role', async () => {
      await RouterTestingHarness.create('/admin/users');

      expect(url()).toBe('/');
      expect(toastError).toHaveBeenCalledWith('You are not allowed to access this page.');
    });
  });

  describe('developer', () => {
    beforeEach(() => setup(testUser({ role: 'DEVELOPER' })));

    it('cannot open the project creation and edition forms', async () => {
      const harness = await RouterTestingHarness.create('/projects/new');
      expect(url()).toBe('/');

      await harness.navigateByUrl('/projects/p1/edit');
      expect(url()).toBe('/');
      expect(toastError).toHaveBeenCalledWith('You are not allowed to access this page.');
    });
  });

  describe('administrator', () => {
    beforeEach(() => setup(testUser({ role: 'ADMIN' })));

    it('opens the user administration page', async () => {
      const harness = await RouterTestingHarness.create('/admin/users');

      expect(url()).toBe('/admin/users');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Users');
      expect(title()).toBe('Users · Smart Project Manager');
    });
  });

  describe('visitor without session', () => {
    beforeEach(() => setup(null));

    it('is sent to the login page, remembering the requested page', async () => {
      const harness = await RouterTestingHarness.create('/some/page');

      expect(url()).toBe('/login?returnUrl=%2Fsome%2Fpage');
      expect(harness.routeNativeElement?.textContent).toContain('Sign in');
      expect(title()).toBe('Sign in · Smart Project Manager');
    });

    it('can open the registration page', async () => {
      const harness = await RouterTestingHarness.create('/register');

      expect(harness.routeNativeElement?.textContent).toContain('Create an account');
      expect(harness.routeNativeElement?.querySelector('mat-sidenav')).toBeNull();
    });
  });
});
