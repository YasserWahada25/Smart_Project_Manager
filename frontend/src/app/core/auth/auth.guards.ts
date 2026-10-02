import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../models/user';
import { ToastService } from '../services/toast.service';
import { AuthService } from './auth.service';

/** Pages of the application: requires a session, otherwise login (then back to the page). */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : {},
  });
};

/** Login / register pages: only for visitors without a session. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;

/**
 * Restricts a route to some roles (UX only: the backend enforces the same rules).
 * Usage: `canActivate: [roleGuard('ADMIN')]`.
 */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    if (inject(AuthService).hasRole(...roles)) return true;
    inject(ToastService).error('You are not allowed to access this page.');
    return inject(Router).createUrlTree(['/']);
  };
}

/** Only internal paths are accepted as post-login destination (no open redirect). */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\:]/.test(value)) {
    return '/';
  }
  return value;
}
