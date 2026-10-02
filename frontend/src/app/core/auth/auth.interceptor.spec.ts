import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FakeAuthService, fakeAuthService, testUser } from '../../testing/test-data';
import { apiErrorInterceptor } from '../http/api-error.interceptor';
import { ToastService } from '../services/toast.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: FakeAuthService;

  function setup(signedIn: boolean) {
    auth = fakeAuthService(signedIn ? testUser() : null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: { error: vi.fn(), info: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpTesting.verify());

  it('adds the bearer token to API requests', () => {
    setup(true);

    http.get('/api/v1/projects').subscribe();

    const request = httpTesting.expectOne('/api/v1/projects');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('never sends the token to another origin', () => {
    setup(true);

    http.get('https://example.com/api/v1/projects').subscribe();

    const request = httpTesting.expectOne('https://example.com/api/v1/projects');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('sends no header without session', () => {
    setup(false);

    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('/api/v1/projects');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(
      { error: { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('ends the session when an authenticated request is rejected with 401', () => {
    setup(true);

    http.get('/api/v1/projects').subscribe({ error: () => undefined });
    httpTesting
      .expectOne('/api/v1/projects')
      .flush(
        { error: { status: 401, code: 'UNAUTHORIZED', message: 'Token has expired' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(auth.expireSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the session on a 403', () => {
    setup(true);

    http.get('/api/v1/users').subscribe({ error: () => undefined });
    httpTesting
      .expectOne('/api/v1/users')
      .flush(
        { error: { status: 403, code: 'FORBIDDEN', message: 'Not allowed' } },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(auth.expireSession).not.toHaveBeenCalled();
  });
});
