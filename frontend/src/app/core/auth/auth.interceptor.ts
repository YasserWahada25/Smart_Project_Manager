import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error';
import { AuthService } from './auth.service';

/**
 * Adds `Authorization: Bearer <token>` to requests sent to our API (never to other
 * origins). If the backend rejects an authenticated request with 401 (token expired,
 * password changed, account deactivated…), the session is ended.
 *
 * Registered before apiErrorInterceptor, so errors reach it already converted to ApiError.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (!token || !request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const authorized = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        auth.expireSession();
      }
      return throwError(() => error);
    }),
  );
};
