import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { User } from './core/models/user';
import { AppTitleStrategy } from './core/routing/app-title.strategy';
import { HealthService } from './core/services/health.service';
import { fakeAuthService, testUser } from './testing/test-data';

describe('App routing', () => {
  function setup(user: User | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
        { provide: AuthService, useValue: fakeAuthService(user) },
        {
          provide: HealthService,
          useValue: { check: () => of({ backend: 'up', database: 'up', checkedAt: new Date() }) },
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
