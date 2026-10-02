const request = require('supertest');
const { createApp } = require('../src/app');
const { User, ROLES } = require('../src/models/user.model');
const { signAccessToken } = require('../src/services/token.service');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');

const app = createApp();
const PASSWORD = 'Secret123';
const NON_EXISTING_ID = '507f1f77bcf86cd799439011';

let admin;
let manager;
let developer;

const createUser = (firstName, role, extra = {}) =>
  User.create({
    firstName,
    lastName: 'Test',
    email: `${firstName.toLowerCase()}@example.com`,
    password: PASSWORD,
    role,
    ...extra,
  });

const auth = (user) => `Bearer ${signAccessToken(user)}`;
const asAdmin = (req) => req.set('Authorization', auth(admin));

beforeAll(async () => {
  await startTestDatabase();
  await User.init();
});

beforeEach(async () => {
  admin = await createUser('Admin', ROLES.ADMIN);
  manager = await createUser('Sara', ROLES.PROJECT_MANAGER);
  developer = await createUser('Youssef', ROLES.DEVELOPER);
});

afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('Access control on /api/v1/users', () => {
  const endpoints = () => [
    ['GET', '/api/v1/users'],
    ['GET', `/api/v1/users/${developer.id}`],
    ['PATCH', `/api/v1/users/${developer.id}/status`],
    ['PATCH', `/api/v1/users/${developer.id}/role`],
  ];

  it('returns 401 without a token', async () => {
    for (const [method, url] of endpoints()) {
      const res = await request(app)[method.toLowerCase()](url);
      expect(res.status).toBe(401);
    }
  });

  it.each([
    ['PROJECT_MANAGER', () => manager],
    ['DEVELOPER', () => developer],
  ])('returns 403 for a %s', async (_role, getUser) => {
    for (const [method, url] of endpoints()) {
      const res = await request(app)[method.toLowerCase()](url).set('Authorization', auth(getUser()));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});

describe('GET /api/v1/users', () => {
  it('returns users newest first with pagination metadata and without passwords', async () => {
    const res = await asAdmin(request(app).get('/api/v1/users'));

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(res.body.data.map((u) => u.firstName)).toEqual(['Youssef', 'Sara', 'Admin']);
    res.body.data.forEach((user) => {
      expect(user.password).toBeUndefined();
      expect(user.id).toBeDefined();
    });
  });

  it('paginates with page and limit', async () => {
    for (let i = 1; i <= 4; i += 1) {
      await createUser(`Dev${i}`, ROLES.DEVELOPER);
    }

    const res = await asAdmin(request(app).get('/api/v1/users?page=2&limit=3'));

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, limit: 3, total: 7, totalPages: 3 });
    expect(res.body.data).toHaveLength(3);
  });

  it('filters by role', async () => {
    const res = await asAdmin(request(app).get('/api/v1/users?role=PROJECT_MANAGER'));

    expect(res.body.data.map((u) => u.email)).toEqual(['sara@example.com']);
  });

  it('filters by account status', async () => {
    await User.updateOne({ _id: developer.id }, { isActive: false });

    const inactive = await asAdmin(request(app).get('/api/v1/users?isActive=false'));
    const active = await asAdmin(request(app).get('/api/v1/users?isActive=true'));

    expect(inactive.body.data.map((u) => u.firstName)).toEqual(['Youssef']);
    expect(active.body.pagination.total).toBe(2);
  });

  it('searches first name, last name and email, case-insensitively', async () => {
    const byName = await asAdmin(request(app).get('/api/v1/users?search=YOUSS'));
    const byEmail = await asAdmin(request(app).get('/api/v1/users?search=sara@'));

    expect(byName.body.data.map((u) => u.firstName)).toEqual(['Youssef']);
    expect(byEmail.body.data.map((u) => u.firstName)).toEqual(['Sara']);
  });

  it('treats regex characters in search as plain text', async () => {
    const res = await asAdmin(request(app).get(`/api/v1/users?search=${encodeURIComponent('.*(')}`));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it.each([
    ['page=0', 'page'],
    ['limit=101', 'limit'],
    ['limit=abc', 'limit'],
    ['role=SUPERUSER', 'role'],
    ['isActive=yes', 'isActive'],
  ])('returns 400 for invalid query %s', async (queryString, field) => {
    const res = await asAdmin(request(app).get(`/api/v1/users?${queryString}`));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe(field);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('returns the user', async () => {
    const res = await asAdmin(request(app).get(`/api/v1/users/${developer.id}`));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: developer.id, email: 'youssef@example.com', role: 'DEVELOPER' });
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await asAdmin(request(app).get(`/api/v1/users/${NON_EXISTING_ID}`));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('User not found');
  });

  it('returns 400 for an invalid id', async () => {
    const res = await asAdmin(request(app).get('/api/v1/users/not-an-id'));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'id', message: 'Invalid user id' }]);
  });
});

describe('PATCH /api/v1/users/:id/status', () => {
  const setStatus = (id, body) => asAdmin(request(app).patch(`/api/v1/users/${id}/status`).send(body));
  const login = () => request(app).post('/api/v1/auth/login').send({ email: 'youssef@example.com', password: PASSWORD });

  it('deactivates an account: its token stops working and it can no longer log in', async () => {
    const developerToken = auth(developer);

    const res = await setStatus(developer.id, { isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: developer.id, isActive: false });

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', developerToken);
    expect(meRes.status).toBe(401);
    expect((await login()).status).toBe(403);
  });

  it('reactivates an account', async () => {
    await setStatus(developer.id, { isActive: false });

    const res = await setStatus(developer.id, { isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(true);
    expect((await login()).status).toBe(200);
  });

  it('forbids an administrator from deactivating their own account', async () => {
    const res = await setStatus(admin.id, { isActive: false });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Administrators cannot change the status of their own account');
    expect((await User.findById(admin.id)).isActive).toBe(true);
  });

  it.each([[{}], [{ isActive: 'false' }], [{ isActive: 0 }]])('returns 400 for body %j', async (body) => {
    const res = await setStatus(developer.id, body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'isActive', message: 'isActive must be a boolean (true or false)' }]);
  });

  it('returns 404 for an unknown user', async () => {
    const res = await setStatus(NON_EXISTING_ID, { isActive: false });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/users/:id/role', () => {
  const setRole = (id, body) => asAdmin(request(app).patch(`/api/v1/users/${id}/role`).send(body));

  it('changes the role, effective immediately for the existing token', async () => {
    const developerToken = auth(developer);

    const res = await setRole(developer.id, { role: 'PROJECT_MANAGER' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('PROJECT_MANAGER');

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', developerToken);
    expect(meRes.body.user.role).toBe('PROJECT_MANAGER');
  });

  it('can promote a user to ADMIN', async () => {
    const res = await setRole(manager.id, { role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('forbids an administrator from changing their own role', async () => {
    const res = await setRole(admin.id, { role: 'DEVELOPER' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Administrators cannot change the role of their own account');
    expect((await User.findById(admin.id)).role).toBe('ADMIN');
  });

  it('returns 400 for an invalid role', async () => {
    const res = await setRole(developer.id, { role: 'SUPERUSER' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'role', message: 'Role must be one of: ADMIN, PROJECT_MANAGER, DEVELOPER' },
    ]);
  });

  it('ignores fields other than role', async () => {
    const res = await setRole(developer.id, { role: 'DEVELOPER', email: 'hacked@example.com', isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'youssef@example.com', isActive: true });
  });
});
