const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const aiClient = require('../src/services/aiClient.service');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createDeveloper, bearer } = require('./helpers/factories');

const app = createApp();

/** Response of the mocked fetch. */
const jsonResponse = (status, body) =>
  new Response(body === undefined ? 'not json' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock;
const realToken = config.aiServiceToken;

beforeAll(startTestDatabase);
beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(async () => {
  fetchMock.mockRestore();
  config.aiServiceToken = realToken;
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('AI client', () => {
  it('sends the service token and a JSON body, and returns the parsed response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await aiClient.request('/api/v1/ai/test', { method: 'POST', json: { a: 1 } });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://ai.test/api/v1/ai/test');
    expect(options.method).toBe('POST');
    expect(options.headers['X-AI-Service-Token']).toBe(realToken);
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe('{"a":1}');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('is unavailable (503) when not configured or unreachable', async () => {
    config.aiServiceToken = undefined;
    await expect(aiClient.request('/x')).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_UNAVAILABLE',
      message: 'The AI service is not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();

    config.aiServiceToken = realToken;
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(aiClient.request('/x')).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
  });

  it('reports a timeout (504)', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

    await expect(aiClient.request('/x')).rejects.toMatchObject({ statusCode: 504, code: 'AI_TIMEOUT' });
  });

  it('passes a refusal of the submitted content on as 400, with its details', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(415, {
        error: { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported file type: .exe', details: [] },
      }),
    );

    await expect(aiClient.request('/x')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unsupported file type: .exe',
    });
  });

  it('hides failures of the AI service behind a 502 (5xx, refused token, invalid body)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: 'Internal server error' } }));
    await expect(aiClient.request('/x')).rejects.toMatchObject({ statusCode: 502, code: 'AI_ERROR' });

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { message: 'Invalid or missing service token' } }));
    await expect(aiClient.request('/x')).rejects.toMatchObject({ statusCode: 502, code: 'AI_ERROR' });

    fetchMock.mockResolvedValueOnce(jsonResponse(200));
    await expect(aiClient.request('/x')).rejects.toMatchObject({
      statusCode: 502,
      message: 'The AI service returned an invalid response',
    });
  });

  it('passes on the explanation of a 502 from the AI service (e.g. no OpenAI credits), never of a 500', async () => {
    const reason = 'The assistant could not answer: the OpenAI account has no credits left';
    fetchMock.mockResolvedValueOnce(jsonResponse(502, { error: { code: 'BAD_GATEWAY', message: reason } }));
    await expect(aiClient.request('/x')).rejects.toMatchObject({ statusCode: 502, code: 'AI_ERROR', message: reason });

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: 'Traceback (most recent call last)…' } }));
    await expect(aiClient.request('/x')).rejects.toMatchObject({
      statusCode: 502,
      message: 'The AI service failed to process the request',
    });
  });
});

describe('GET /api/v1/ai/status', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/ai/status')).status).toBe(401);
  });

  it('reports the AI service and its LLM when available', async () => {
    const user = await createDeveloper();
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 'ok',
        service: 'smart-project-manager-ai',
        llm: { provider: 'openai', configured: true, model: 'gpt-4o-mini' },
      }),
    );

    const res = await request(app).get('/api/v1/ai/status').set('Authorization', bearer(user));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      available: true,
      llm: { provider: 'openai', configured: true, model: 'gpt-4o-mini' },
    });
  });

  it('reports why the AI service is unavailable (never an error)', async () => {
    const user = await createDeveloper();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const unreachable = await request(app).get('/api/v1/ai/status').set('Authorization', bearer(user));

    config.aiServiceToken = undefined;
    const notConfigured = await request(app).get('/api/v1/ai/status').set('Authorization', bearer(user));

    expect(unreachable.body).toEqual({ available: false, reason: 'UNREACHABLE', llm: null });
    expect(notConfigured.body).toEqual({ available: false, reason: 'NOT_CONFIGURED', llm: null });
  });
});
