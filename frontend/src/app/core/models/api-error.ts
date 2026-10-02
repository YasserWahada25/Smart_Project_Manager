/** Field-level validation message returned by the backend (`error.details`). */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/**
 * Normalized HTTP error, mirroring the backend error format (docs/api.md):
 * `{ "error": { "status", "code", "message", "details" } }`.
 * Every failed HttpClient request emits an ApiError (see apiErrorInterceptor).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The server could not be reached (offline, server stopped, DNS…). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Message of a given field, if the backend reported one (form validation). */
  fieldMessage(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}
