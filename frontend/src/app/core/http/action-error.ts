import { ApiError } from '../models/api-error';

/**
 * Message to show (toast) when a user action fails, or null when the error is already
 * reported globally: network errors and 5xx by apiErrorInterceptor, 401 by authInterceptor
 * (the session ends).
 */
export function actionErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return 'An unexpected error occurred.';
  if (error.isNetworkError || error.status === 401 || error.status >= 500) return null;
  return error.message;
}
