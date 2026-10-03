import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { testToken, testUser } from '../../testing/test-data';
import { apiErrorInterceptor } from '../http/api-error.interceptor';
import { ToastService } from '../services/toast.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let httpTesting: HttpTestingController;
  let toast: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function setup(): AuthService {
    toast = { info: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: toast },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpTesting.verify();
    vi.useRealTimers();
  });

  it('starts without session', () => {
    const auth = setup();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
  });

  it('logs in, exposes the user and persists the session', () => {
    const auth = setup();
    const token = testToken();
    let loggedIn: unknown;

    auth
      .login({ email: 'sara@example.com', password: 'Secret123' })
      .subscribe((user) => (loggedIn = user));
    const request = httpTesting.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'sara@example.com', password: 'Secret123' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ token, tokenType: 'Bearer', expiresIn: '1d', user: testUser() });

    expect(loggedIn).toEqual(testUser());
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe(token);
    expect(localStorage.getItem('spm.auth.token')).toBe(token);
  });

  it('registers and opens a session', () => {
    const auth = setup();
    const body = {
      firstName: 'Youssef',
      lastName: 'Alami',
      email: 'youssef@example.com',
      password: 'Secret123',
      role: 'DEVELOPER' as const,
    };

    auth.register(body).subscribe();
    const request = httpTesting.expectOne('/api/v1/auth/register');
    expect(request.request.body).toEqual(body);
    request.flush({
      token: testToken(),
      tokenType: 'Bearer',
      expiresIn: '1d',
      user: testUser({ role: 'DEVELOPER' }),
    });

    expect(auth.hasRole('DEVELOPER')).toBe(true);
    expect(auth.hasRole('ADMIN', 'PROJECT_MANAGER')).toBe(false);
  });

  it('restores a valid session from storage', () => {
    const token = testToken();
    localStorage.setItem('spm.auth.token', token);
    localStorage.setItem('spm.auth.user', JSON.stringify(testUser()));

    const auth = setup();

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.firstName).toBe('Sara');
  });

  it('discards an expired session found in storage', () => {
    localStorage.setItem('spm.auth.token', testToken(-10));
    localStorage.setItem('spm.auth.user', JSON.stringify(testUser()));

    const auth = setup();

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('spm.auth.token')).toBeNull();
  });

  it('refreshes the current user with the bearer token', () => {
    localStorage.setItem('spm.auth.token', 'unused');
    const auth = setup();
    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    const token = testToken();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token, tokenType: 'Bearer', expiresIn: '1d', user: testUser() });

    auth.refreshOnStartup();
    const request = httpTesting.expectOne('/api/v1/auth/me');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({ user: testUser({ firstName: 'Sarah', role: 'ADMIN' }) });

    expect(auth.currentUser()?.firstName).toBe('Sarah');
    expect(auth.hasRole('ADMIN')).toBe(true);
    expect(JSON.parse(localStorage.getItem('spm.auth.user') ?? '{}').firstName).toBe('Sarah');
  });

  it('ends the session when the backend answers 401, and goes to the login page', () => {
    const auth = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token: testToken(), tokenType: 'Bearer', expiresIn: '1d', user: testUser() });

    auth.refreshCurrentUser().subscribe({ error: () => undefined });
    httpTesting
      .expectOne('/api/v1/auth/me')
      .flush(
        { error: { status: 401, code: 'UNAUTHORIZED', message: 'Token has expired' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('spm.auth.token')).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('Your session has expired. Please log in again.');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('logs out automatically when the token expires', () => {
    vi.useFakeTimers();
    const auth = setup();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token: testToken(5), tokenType: 'Bearer', expiresIn: '5s', user: testUser() });

    vi.advanceTimersByTime(4000);
    expect(auth.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('updates the user of the session and keeps the token', () => {
    const auth = setup();
    auth.updateCurrentUser(testUser());
    expect(auth.isAuthenticated()).toBe(false);

    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    const token = testToken();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token, tokenType: 'Bearer', expiresIn: '1d', user: testUser() });

    auth.updateCurrentUser(testUser({ jobTitle: 'Tech lead' }));

    expect(auth.currentUser()?.jobTitle).toBe('Tech lead');
    expect(auth.token()).toBe(token);
    expect(JSON.parse(localStorage.getItem('spm.auth.user') ?? '{}').jobTitle).toBe('Tech lead');
  });

  it('switches to the new token returned after a password change', () => {
    const auth = setup();
    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token: testToken(), tokenType: 'Bearer', expiresIn: '1d', user: testUser() });
    const newToken = testToken(7200);

    const user = auth.replaceSession({
      token: newToken,
      tokenType: 'Bearer',
      expiresIn: '1d',
      user: testUser(),
    });

    expect(user).toEqual(testUser());
    expect(auth.token()).toBe(newToken);
    expect(localStorage.getItem('spm.auth.token')).toBe(newToken);
  });

  it('logs out', () => {
    const auth = setup();
    auth.login({ email: 'a@b.co', password: 'x' }).subscribe();
    httpTesting
      .expectOne('/api/v1/auth/login')
      .flush({ token: testToken(), tokenType: 'Bearer', expiresIn: '1d', user: testUser() });

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('spm.auth.user')).toBeNull();
  });
});
