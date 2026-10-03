import { Route, Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';

/**
 * Public page (login, register) displayed in the AuthLayout, for visitors without a session.
 * Each public page has its own non-empty path on purpose: an empty-path parent would also
 * match "/" and, combined with guestGuard, create a redirect loop for signed-in users.
 */
function publicPage(path: string, title: string, loadPage: Route['loadComponent']): Route {
  return {
    path,
    canActivate: [guestGuard],
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [{ path: '', title, loadComponent: loadPage }],
  };
}

// Layouts and pages are lazy-loaded: each one is downloaded only when first needed, so the
// initial bundle only contains the application core (router, HTTP, authentication).
export const routes: Routes = [
  publicPage('login', 'Sign in', () => import('./features/auth/login/login').then((m) => m.Login)),
  publicPage('register', 'Create an account', () =>
    import('./features/auth/register/register').then((m) => m.Register),
  ),
  // Application (authenticated users).
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Home',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'projects',
        title: 'Projects',
        loadComponent: () =>
          import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
      },
      // Before 'projects/:id', otherwise "new" would be read as a project id.
      {
        path: 'projects/new',
        title: 'New project',
        canActivate: [roleGuard('PROJECT_MANAGER')],
        loadComponent: () =>
          import('./features/projects/project-form/project-form').then((m) => m.ProjectForm),
      },
      // Before the project shell, whose children would otherwise be searched for "edit".
      {
        path: 'projects/:id/edit',
        title: 'Edit the project',
        canActivate: [roleGuard('PROJECT_MANAGER')],
        loadComponent: () =>
          import('./features/projects/project-form/project-form').then((m) => m.ProjectForm),
      },
      // Project page: header + tabs (child routes sharing the ProjectContext of the shell).
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/projects/project-shell/project-shell').then((m) => m.ProjectShell),
        children: [
          {
            path: '',
            title: 'Project',
            loadComponent: () =>
              import('./features/projects/project-overview/project-overview').then(
                (m) => m.ProjectOverview,
              ),
          },
          {
            path: 'sprints',
            title: 'Sprints',
            loadComponent: () =>
              import('./features/sprints/sprint-list/sprint-list').then((m) => m.SprintList),
          },
          {
            path: 'tasks',
            title: 'Tasks',
            loadComponent: () =>
              import('./features/tasks/task-list/task-list').then((m) => m.TaskList),
          },
          {
            path: 'board',
            title: 'Board',
            loadComponent: () =>
              import('./features/kanban/kanban-board/kanban-board').then((m) => m.KanbanBoard),
          },
          {
            path: 'activity',
            title: 'Activity',
            loadComponent: () =>
              import('./features/activity/project-activity/project-activity').then(
                (m) => m.ProjectActivity,
              ),
          },
          {
            path: 'dashboard',
            title: 'Project dashboard',
            loadComponent: () =>
              import('./features/dashboard/project-dashboard/project-dashboard').then(
                (m) => m.ProjectDashboard,
              ),
          },
          {
            path: 'tasks/:taskId',
            title: 'Task',
            loadComponent: () =>
              import('./features/tasks/task-detail/task-detail').then((m) => m.TaskDetail),
          },
        ],
      },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'search',
        title: 'Search',
        loadComponent: () =>
          import('./features/search/search-page/search-page').then((m) => m.SearchPage),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        loadComponent: () =>
          import('./features/notifications/notification-list/notification-list').then(
            (m) => m.NotificationList,
          ),
      },
      {
        path: 'my-tasks',
        title: 'My tasks',
        loadComponent: () => import('./features/tasks/my-tasks/my-tasks').then((m) => m.MyTasks),
      },
      {
        path: 'profile',
        title: 'My profile',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'admin/users',
        title: 'Users',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
