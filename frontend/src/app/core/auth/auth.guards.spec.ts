import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { fakeAuthService, testUser } from '../../testing/test-data';
import { User } from '../models/user';
import { ToastService } from '../services/toast.service';
import { authGuard, guestGuard, roleGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let toastError: ReturnType<typeof vi.fn>;

  function setup(user: User | null) {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuthService(user) },
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
  }

  function run(guard: typeof authGuard, url = '/'): string | true {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as true);
  }

  describe('authGuard', () => {
    it('lets an authenticated user in', () => {
      setup(testUser());
      expect(run(authGuard, '/projects')).toBe(true);
    });

    it('redirects a visitor to the login page, keeping the requested page', () => {
      setup(null);
      expect(run(authGuard, '/projects/42')).toBe('/login?returnUrl=%2Fprojects%2F42');
      TestBed.resetTestingModule();
      setup(null);
      expect(run(authGuard, '/')).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('lets a visitor see the login page and sends a signed-in user home', () => {
      setup(null);
      expect(run(guestGuard)).toBe(true);
      TestBed.resetTestingModule();
      setup(testUser());
      expect(run(guestGuard)).toBe('/');
    });
  });

  describe('roleGuard', () => {
    it('allows the listed roles', () => {
      setup(testUser({ role: 'ADMIN' }));
      expect(run(roleGuard('ADMIN'))).toBe(true);
    });

    it('refuses other roles with a message and goes home', () => {
      setup(testUser({ role: 'DEVELOPER' }));
      expect(run(roleGuard('ADMIN', 'PROJECT_MANAGER'))).toBe('/');
      expect(toastError).toHaveBeenCalledWith('You are not allowed to access this page.');
    });
  });

  describe('safeReturnUrl', () => {
    it.each([
      ['/projects/42?tab=tasks', '/projects/42?tab=tasks'],
      [undefined, '/'],
      ['', '/'],
      ['projects', '/'],
      ['//evil.example.com', '/'],
      ['/\\evil.example.com', '/'],
      ['https://evil.example.com', '/'],
      ['/redirect?to=javascript:alert(1)', '/'],
    ])('%p → %p', (input, expected) => {
      expect(safeReturnUrl(input)).toBe(expected);
    });
  });
});
