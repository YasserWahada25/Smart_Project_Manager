/**
 * HTTP client of the AI service (FastAPI). Only the backend talks to it: the browser never
 * calls the AI service directly. Every request carries the shared secret AI_SERVICE_TOKEN and
 * has a timeout; failures are converted into clear API errors:
 *  - 503 AI_UNAVAILABLE  — not configured or unreachable;
 *  - 504 AI_TIMEOUT      — no answer in time;
 *  - 400                 — the submitted content was refused (type, size, nothing usable…);
 *  - 502 AI_ERROR        — the AI service failed or answered something unusable.
 */
const { config } = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const STATUS_TIMEOUT_MS = 3000;

const unavailable = (message = 'The AI service is unavailable') =>
  new ApiError(503, 'AI_UNAVAILABLE', message);
const failed = (message = 'The AI service failed to process the request') =>
  new ApiError(502, 'AI_ERROR', message);

/**
 * @param {string} path      e.g. '/api/v1/ai/projects/plan'
 * @param {object} options   json (object body) or form (FormData body), method, timeoutMs
 */
async function request(path, { method = 'GET', json, form, timeoutMs = config.aiTimeoutMs } = {}) {
  if (!config.aiServiceToken) throw unavailable('The AI service is not configured');

  const headers = { 'X-AI-Service-Token': config.aiServiceToken };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let response;
  try {
    response = await fetch(new URL(path, config.aiServiceUrl), {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI_TIMEOUT', 'The AI service did not answer in time');
    }
    logger.warn(`AI service unreachable: ${err.message}`);
    throw unavailable();
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const remote = payload?.error;
    if (response.status === 401) {
      logger.error('The AI service refused the backend token: check AI_SERVICE_TOKEN on both sides');
      throw failed();
    }
    if (response.status < 500 && remote?.message) {
      // The submitted content is the problem (document type or size, nothing usable…).
      throw ApiError.badRequest(remote.message, remote.details?.length ? remote.details : undefined);
    }
    logger.error(`AI service error ${response.status}: ${remote?.message ?? 'no error body'}`);
    throw failed();
  }
  if (payload === null) throw failed('The AI service returned an invalid response');
  return payload;
}

/** Availability of the AI service and of its LLM; never throws. */
async function getStatus() {
  if (!config.aiServiceToken) return { available: false, reason: 'NOT_CONFIGURED', llm: null };
  try {
    const health = await request('/api/v1/health', { timeoutMs: STATUS_TIMEOUT_MS });
    return { available: true, llm: health.llm ?? null };
  } catch (err) {
    return { available: false, reason: err.code === 'AI_TIMEOUT' ? 'TIMEOUT' : 'UNREACHABLE', llm: null };
  }
}

module.exports = { request, getStatus };
