const request = require('supertest');
const { createApp } = require('../src/app');
const { startTestDatabase, stopTestDatabase } = require('./helpers/db');

const app = createApp();

describe('GET /api/v1/health', () => {
  describe('when MongoDB is connected', () => {
    beforeAll(startTestDatabase);
    afterAll(stopTestDatabase);

    it('returns 200 with status "ok"', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toMatchObject({
        status: 'ok',
        service: 'smart-project-manager-backend',
        database: { status: 'connected' },
      });
      expect(typeof res.body.uptime).toBe('number');
      expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
    });
  });

  describe('when MongoDB is not connected', () => {
    it('returns 503 with status "degraded"', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({
        status: 'degraded',
        database: { status: 'disconnected' },
      });
    });
  });
});
