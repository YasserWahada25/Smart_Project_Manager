const request = require('supertest');
const { createApp } = require('../src/app');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createAdmin, createManager, createDeveloper, bearer } = require('./helpers/factories');

const app = createApp();

let admin;
let manager;
let dev;

const directory = (user, query = '') =>
  request(app).get(`/api/v1/developers${query}`).set('Authorization', bearer(user));

beforeAll(startTestDatabase);
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  dev = await createDeveloper({
    firstName: 'Youssef',
    lastName: 'Alami',
    skills: [{ name: 'Node.js', level: 'ADVANCED' }],
  });
  await createDeveloper({ firstName: 'Amira', lastName: 'Ben', skills: [{ name: 'Angular', level: 'EXPERT' }] });
  await createDeveloper({ firstName: 'Old', lastName: 'Zed', isActive: false });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('GET /api/v1/developers', () => {
  it('lists active developers only, sorted by last name, with public fields', async () => {
    const res = await directory(manager);

    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.firstName)).toEqual(['Youssef', 'Amira']);
    expect(res.body.data[0]).toEqual({
      id: dev.id,
      firstName: 'Youssef',
      lastName: 'Alami',
      email: dev.email,
      jobTitle: '',
      skills: [{ name: 'Node.js', level: 'ADVANCED' }],
    });
  });

  it('filters by skill name (exact, case-insensitive) and by search text', async () => {
    expect((await directory(manager, '?skill=node.js')).body.data.map((d) => d.firstName)).toEqual(['Youssef']);
    expect((await directory(manager, '?skill=node')).body.data).toEqual([]);
    expect((await directory(manager, '?search=amir')).body.data.map((d) => d.firstName)).toEqual(['Amira']);
    expect((await directory(manager, '?search=ami')).body.data.map((d) => d.firstName)).toEqual(['Youssef', 'Amira']);
  });

  it('is available to admins, forbidden to developers', async () => {
    expect((await directory(admin)).status).toBe(200);
    expect((await directory(dev)).status).toBe(403);
  });
});
