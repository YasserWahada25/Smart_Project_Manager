const request = require('supertest');
const { createApp } = require('../src/app');

const app = createApp({ corsOrigins: ['http://localhost:4200'] });

describe('Express application', () => {
  it('returns a JSON 404 error for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Route not found: GET /api/v1/does-not-exist',
      },
    });
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Malformed JSON in request body' });
  });

  it('returns 413 when the JSON body exceeds the size limit', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 1) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sets security headers and hides the X-Powered-By header', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows CORS requests from the configured frontend origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:4200');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('does not allow CORS requests from other origins', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
