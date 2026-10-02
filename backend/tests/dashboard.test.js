const request = require('supertest');
const { createApp } = require('../src/app');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const {
  createAdmin,
  createManager,
  createDeveloper,
  createProject,
  createSprint,
  createTask,
  bearer,
} = require('./helpers/factories');

const app = createApp();
const DAY = 24 * 60 * 60 * 1000;

let admin;
let manager;
let otherManager;
let dev;
let dev2;
let idleDev;
let dev3;
let shop;
let sprint;

const get = (user, url) => request(app).get(`/api/v1${url}`).set('Authorization', bearer(user));

beforeAll(startTestDatabase);
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  otherManager = await createManager();
  dev = await createDeveloper({ firstName: 'Youssef' });
  dev2 = await createDeveloper({ firstName: 'Amira' });
  idleDev = await createDeveloper({ firstName: 'Idle' });
  dev3 = await createDeveloper({ firstName: 'Other' });

  shop = await createProject(manager, {
    name: 'Shop',
    status: 'ACTIVE',
    members: [dev._id, dev2._id, idleDev._id],
    deadline: new Date(Date.now() + 30 * DAY),
  });
  const blog = await createProject(otherManager, { name: 'Blog', members: [dev3._id] });

  sprint = await createSprint(shop, {
    name: 'Sprint 1',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 5 * DAY),
    endDate: new Date(Date.now() + 5 * DAY),
  });
  await createSprint(shop, { name: 'Sprint 0', status: 'COMPLETED' });

  await createTask(shop, { sprint: sprint._id, status: 'DONE', complexity: 5, assignee: dev._id, priority: 'HIGH' });
  await createTask(shop, { sprint: sprint._id, status: 'IN_PROGRESS', complexity: 3, assignee: dev._id });
  await createTask(shop, { sprint: sprint._id, status: 'BLOCKED', complexity: 8, assignee: dev2._id, priority: 'CRITICAL' });
  await createTask(shop, { complexity: 2, deadline: new Date(Date.now() - DAY), priority: 'LOW' });
  await createTask(blog, { complexity: 1, assignee: dev3._id });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('GET /api/v1/dashboard', () => {
  it('gives a project manager the indicators of the projects they manage', async () => {
    const res = await get(manager, '/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('PROJECT_MANAGER');
    expect(res.body.projects).toEqual({
      total: 1,
      active: 1,
      byStatus: { PLANNING: 0, ACTIVE: 1, PAUSED: 0, COMPLETED: 0, ARCHIVED: 0 },
    });
    expect(res.body.tasks).toEqual({
      total: 4,
      completed: 1,
      blocked: 1,
      overdue: 1,
      byStatus: { TODO: 1, IN_PROGRESS: 1, CODE_REVIEW: 0, TESTING: 0, DONE: 1, BLOCKED: 1 },
      byPriority: { LOW: 1, MEDIUM: 1, HIGH: 1, CRITICAL: 1 },
    });

    expect(res.body.sprints.active).toBe(1);
    const [active] = res.body.sprints.activeSprints;
    expect(active).toMatchObject({ name: 'Sprint 1', project: { name: 'Shop' }, daysRemaining: 5 });
    expect(active.stats).toMatchObject({ totalPoints: 16, completedPoints: 5, progress: 31 });

    expect(res.body.workload.map((w) => [w.user.firstName, w.openTasks, w.openPoints, w.inProgressTasks, w.blockedTasks])).toEqual([
      ['Amira', 1, 8, 0, 1],
      ['Youssef', 1, 3, 1, 0],
    ]);
    expect(res.body).not.toHaveProperty('myTasks');
    expect(res.body).not.toHaveProperty('platform');
  });

  it('gives a developer their projects and their own task indicators', async () => {
    const res = await get(dev, '/dashboard');

    expect(res.body.projects.total).toBe(1);
    expect(res.body.myTasks).toMatchObject({ total: 2, completed: 1, byStatus: expect.objectContaining({ IN_PROGRESS: 1 }) });
    expect(res.body).not.toHaveProperty('workload');

    const other = await get(dev3, '/dashboard');
    expect(other.body.projects.total).toBe(1);
    expect(other.body.tasks.total).toBe(1);
  });

  it('gives an admin every project plus platform indicators', async () => {
    const res = await get(admin, '/dashboard');

    expect(res.body.projects.total).toBe(2);
    expect(res.body.tasks.total).toBe(5);
    expect(res.body.platform.users).toEqual({
      total: 7,
      active: 7,
      inactive: 0,
      byRole: { ADMIN: 1, PROJECT_MANAGER: 2, DEVELOPER: 4 },
    });
  });

  it('returns empty indicators for a user without projects', async () => {
    const newcomer = await createDeveloper();

    const res = await get(newcomer, '/dashboard');

    expect(res.body.projects.total).toBe(0);
    expect(res.body.tasks.total).toBe(0);
    expect(res.body.sprints).toEqual({ active: 0, activeSprints: [] });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/dashboard')).status).toBe(401);
  });
});

describe('GET /api/v1/projects/:id/dashboard', () => {
  it('returns the indicators of one project, with every member in the workload', async () => {
    const res = await get(dev2, `/projects/${shop.id}/dashboard`);

    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({ name: 'Shop', status: 'ACTIVE', daysRemaining: 30, memberCount: 3 });
    expect(res.body.tasks).toMatchObject({ total: 4, overdue: 1 });
    expect(res.body.sprints).toMatchObject({
      total: 2,
      byStatus: { PLANNED: 0, ACTIVE: 1, COMPLETED: 1, CANCELLED: 0 },
      activeSprint: { name: 'Sprint 1', stats: expect.objectContaining({ progress: 31 }) },
    });
    expect(res.body.workload.map((w) => [w.user.firstName, w.openPoints])).toEqual([
      ['Amira', 8],
      ['Youssef', 3],
      ['Idle', 0],
    ]);
  });

  it('returns 404 to outsiders and 400 for an invalid id', async () => {
    expect((await get(dev3, `/projects/${shop.id}/dashboard`)).status).toBe(404);
    expect((await get(manager, '/projects/abc/dashboard')).status).toBe(400);
  });
});
