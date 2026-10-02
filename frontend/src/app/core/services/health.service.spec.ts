import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiErrorInterceptor } from '../http/api-error.interceptor';
import { ApiError } from '../models/api-error';
import { SystemStatus } from '../models/system-status';
import { HealthService } from './health.service';
import { ToastService } from './toast.service';

describe('HealthService', () => {
  let service: HealthService;
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
    service = TestBed.inject(HealthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function check(): { status: () => SystemStatus | undefined; error: () => unknown } {
    let status: SystemStatus | undefined;
    let error: unknown;
    service.check().subscribe({ next: (value) => (status = value), error: (e) => (error = e) });
    return { status: () => status, error: () => error };
  }

  it('calls GET /api/v1/health and reports both services up', () => {
    const result = check();

    const request = httpTesting.expectOne('/api/v1/health');
    expect(request.request.method).toBe('GET');
    request.flush({
      status: 'ok',
      service: 'smart-project-manager-backend',
      uptime: 10,
      timestamp: '2026-10-02T10:00:00.000Z',
      database: { status: 'connected' },
    });

    expect(result.status()).toMatchObject({ backend: 'up', database: 'up' });
    expect(result.status()?.checkedAt).toBeInstanceOf(Date);
  });

  it('reports "backend up, database down" when the backend answers 503', () => {
    const result = check();

    httpTesting
      .expectOne('/api/v1/health')
      .flush(
        { status: 'degraded', database: { status: 'disconnected' } },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(result.status()).toMatchObject({ backend: 'up', database: 'down' });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('emits an ApiError when the backend is unreachable, without global toast', () => {
    const result = check();

    httpTesting
      .expectOne('/api/v1/health')
      .flush('Bad gateway', { status: 502, statusText: 'Bad Gateway' });

    expect(result.error()).toBeInstanceOf(ApiError);
    expect(result.error()).toMatchObject({ status: 502 });
    expect(toastError).not.toHaveBeenCalled();
  });
});
