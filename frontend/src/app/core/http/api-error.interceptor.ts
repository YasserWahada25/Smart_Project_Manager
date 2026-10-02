import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError, ApiErrorDetail } from '../models/api-error';
import { ToastService } from '../services/toast.service';

/**
 * Set to true on a request whose errors are fully handled by the caller, to skip the
 * global error toast: `http.get(url, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })`.
 */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
  };
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You are not allowed to perform this action.',
  404: 'The requested resource was not found.',
  502: 'The server is unavailable. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The server is unavailable. Please try again later.',
};

/** Converts an HttpErrorResponse into an ApiError, using the backend message when there is one. */
export function toApiError(response: HttpErrorResponse): ApiError {
  if (response.status === 0) {
    return new ApiError(0, 'NETWORK_ERROR', FALLBACK_MESSAGES[0]);
  }

  const body = response.error as BackendErrorBody | null;
  const backendError = body && typeof body === 'object' ? body.error : undefined;
  if (backendError?.message) {
    return new ApiError(
      response.status,
      backendError.code ?? 'UNKNOWN_ERROR',
      backendError.message,
      backendError.details ?? [],
    );
  }

  const fallback =
    FALLBACK_MESSAGES[response.status] ??
    (response.status >= 500
      ? 'An unexpected server error occurred. Please try again later.'
      : 'The request could not be completed.');
  return new ApiError(response.status, 'UNKNOWN_ERROR', fallback);
}

/**
 * Normalizes every HTTP error into an ApiError and shows a toast for errors the user
 * cannot fix from the current form: network failures and server errors (5xx).
 * Client errors (4xx) are left to the calling component (validation messages, etc.).
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const apiError = toApiError(error);
      const isGlobalError = apiError.isNetworkError || apiError.status >= 500;
      if (isGlobalError && !request.context.get(SKIP_ERROR_TOAST)) {
        toast.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
