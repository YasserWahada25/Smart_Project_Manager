import { Route, Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';

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
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
