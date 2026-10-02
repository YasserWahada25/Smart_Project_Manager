import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/api-error.interceptor';
import { ApiError } from '../models/api-error';
import { HealthReport, SystemStatus } from '../models/system-status';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/health`;

  /**
   * Checks the backend and its database. The backend answers 503 when MongoDB is down: this
   * is reported as "backend up, database down". Any other failure means the backend itself
   * is unreachable and is emitted as an ApiError. The caller displays the result, so the
   * global error toast is disabled for this request.
   */
  check(): Observable<SystemStatus> {
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);

    return this.http.get<HealthReport>(this.url, { context }).pipe(
      map((report) => ({
        backend: 'up' as const,
        database: report.database.status === 'connected' ? ('up' as const) : ('down' as const),
        checkedAt: new Date(),
      })),
      catchError((error: unknown) => {
        if (error instanceof ApiError && error.status === 503 && error.code === 'UNKNOWN_ERROR') {
          return of<SystemStatus>({ backend: 'up', database: 'down', checkedAt: new Date() });
        }
        return throwError(() => error);
      }),
    );
  }
}
