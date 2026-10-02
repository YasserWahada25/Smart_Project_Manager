/** Raw response of GET /api/v1/health (see docs/api.md). */
export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  timestamp: string;
  database: { status: string };
}

export type ServiceState = 'up' | 'down';

/** Availability of the backend and its database, as shown to the user. */
export interface SystemStatus {
  backend: ServiceState;
  database: ServiceState;
  checkedAt: Date;
}
