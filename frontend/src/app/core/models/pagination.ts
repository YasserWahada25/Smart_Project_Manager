/** Paginated list returned by the backend: `{ data, pagination }` (docs/api.md). */
export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
