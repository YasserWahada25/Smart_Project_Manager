const request = require('supertest');
const { createApp } = require('../src/app');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createManager, createDeveloper, createProject, createTask, bearer } = require('./helpers/factories');

const app = createApp();

let manager;
let dev;
let outsiderManager;

const search = (user, query) => request(app).get(`/api/v1/search${query}`).set('Authorization', bearer(user));

beforeAll(startTestDatabase);
beforeEach(async () => {
  manager = await createManager();
  dev = await createDeveloper();
  outsiderManager = await createManager();

  const shop = await createProject(manager, { name: 'Payment platform', members: [dev._id] });
  const other = await createProject(outsiderManager, { name: 'Payment secrets' });
  await createTask(shop, { title: 'Stripe payment integration', assignee: dev._id });
  await createTask(shop, { title: 'Cart', description: 'Compute the payment total' });
  await createTask(shop, { title: 'Login page' });
  await createTask(other, { title: 'Hidden payment task' });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('GET /api/v1/search', () => {
  it('finds projects and tasks the user can see (title, name or description)', async () => {
    const res = await search(dev, '?q=PAYMENT');

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('PAYMENT');
    expect(res.body.projects.total).toBe(1);
    expect(res.body.projects.items.map((p) => p.name)).toEqual(['Payment platform']);
    expect(res.body.tasks.total).toBe(2);
    expect(res.body.tasks.items.map((t) => t.title).sort()).toEqual(['Cart', 'Stripe payment integration']);
    expect(res.body.tasks.items[0].project).toMatchObject({ name: 'Payment platform' });
  });

  it('limits the number of items per type but reports the total', async () => {
    const res = await search(manager, '?q=payment&limit=1');

    expect(res.body.tasks.items).toHaveLength(1);
    expect(res.body.tasks.total).toBe(2);
  });

  it('treats regex characters as plain text', async () => {
    const res = await search(manager, `?q=${encodeURIComponent('.*(')}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.total).toBe(0);
  });

  it.each(['', '?q=a', `?q=${'x'.repeat(101)}`, '?q=payment&limit=50'])('returns 400 for %s', async (query) => {
    expect((await search(manager, query)).status).toBe(400);
  });
});
