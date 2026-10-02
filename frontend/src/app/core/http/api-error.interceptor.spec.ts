import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../models/api-error';
import { ToastService } from '../services/toast.service';
import { SKIP_ERROR_TOAST, apiErrorInterceptor } from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function requestError(context?: HttpContext): () => unknown {
    let received: unknown;
    http.get('/api/v1/resource', { context }).subscribe({ error: (error) => (received = error) });
    return () => received;
  }

  it('lets successful responses through', () => {
    let body: unknown;
    http.get('/api/v1/resource').subscribe((value) => (body = value));

    httpTesting.expectOne('/api/v1/resource').flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('converts the backend error format into an ApiError, without toast for a 4xx', () => {
    const error = requestError();

    httpTesting.expectOne('/api/v1/resource').flush(
      {
        error: {
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          details: [{ field: 'name', message: 'Project name is required' }],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error()).toBeInstanceOf(ApiError);
    expect(error()).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Validation failed',
    });
    expect((error() as ApiError).fieldMessage('name')).toBe('Project name is required');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('reports a network failure (status 0) and shows a toast', () => {
    const error = requestError();

    httpTesting.expectOne('/api/v1/resource').error(new ProgressEvent('error'));

    expect(error()).toMatchObject({ status: 0, code: 'NETWORK_ERROR', isNetworkError: true });
    expect(toastError).toHaveBeenCalledWith(
      'Cannot reach the server. Check your connection and try again.',
    );
  });

  it('uses a fallback message for a server error without backend body, and shows a toast', () => {
    const error = requestError();

    httpTesting
      .expectOne('/api/v1/resource')
      .flush('Bad gateway', { status: 502, statusText: 'Bad Gateway' });

    expect(error()).toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
      message: 'The server is unavailable. Please try again later.',
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message of a 500 in the toast', () => {
    requestError();

    httpTesting
      .expectOne('/api/v1/resource')
      .flush(
        { error: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } },
        { status: 500, statusText: 'Internal Server Error' },
      );

    expect(toastError).toHaveBeenCalledWith('Internal server error');
  });

  it('does not show a toast when the request sets SKIP_ERROR_TOAST', () => {
    const error = requestError(new HttpContext().set(SKIP_ERROR_TOAST, true));

    httpTesting.expectOne('/api/v1/resource').error(new ProgressEvent('error'));

    expect(error()).toBeInstanceOf(ApiError);
    expect(toastError).not.toHaveBeenCalled();
  });
});
