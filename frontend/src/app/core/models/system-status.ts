/** Raw response of GET /api/v1/health (see docs/api.md). */
export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  timestamp: string;
  database: { status: string };
}

export type ServiceState = 'up' | 'down';

/** GET /api/v1/ai/status: the AI service as seen by the backend. */
export interface AiStatus {
  available: boolean;
  /** Why it is unavailable. */
  reason?: 'NOT_CONFIGURED' | 'UNREACHABLE' | 'TIMEOUT';
  /** Whether an LLM key is set in the AI service (otherwise the local analyzer is used). */
  llm: { provider: string; configured: boolean; model: string | null } | null;
}

/** Display name of the LLM provider reported by the AI service (detected from OPENAI_BASE_URL). */
const LLM_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  groq: 'Groq',
  ollama: 'Ollama',
};

export function llmProviderLabel(provider: string | null | undefined): string {
  return (provider && LLM_PROVIDER_LABELS[provider]) || 'the LLM provider';
}

/** Availability of the backend and its database, as shown to the user. */
export interface SystemStatus {
  backend: ServiceState;
  database: ServiceState;
  checkedAt: Date;
}
