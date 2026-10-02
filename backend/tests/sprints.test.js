const request = require('supertest');
const { createApp } = require('../src/app');
const { Sprint } = require('../src/models/sprint.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const {
  createAdmin,
  createManager,
  createDeveloper,
  createProject,
  createSprint,
  bearer,
} = require('./helpers/factories');

const app = createApp();

let admin;
let manager;
let dev;
let outsider;
let project;

const as = (user, req) => req.set('Authorization', bearer(user));
const api = {
  create: (user, projectId, body) => as(user, request(app).post(`/api/v1/projects/${projectId}/sprints`).send(body)),
  list: (user, projectId, query = '') => as(user, request(app).get(`/api/v1/projects/${projectId}/sprints${query}`)),
  get: (user, id) => as(user, request(app).get(`/api/v1/sprints/${id}`)),
  update: (user, id, body) => as(user, request(app).patch(`/api/v1/sprints/${id}`).send(body)),
  status: (user, id, status) => as(user, request(app).patch(`/api/v1/sprints/${id}/status`).send({ status })),
  remove: (user, id) => as(user, request(app).delete(`/api/v1/sprints/${id}`)),
};

const validSprint = {
  name: 'Sprint 1',
  objective: 'Authentication and catalog',
  startDate: '2026-10-05',
  endDate: '2026-10-18',
};

beforeAll(async () => {
  await startTestDatabase();
  await Sprint.init(); // build the "one active sprint per project" index
});
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  dev = await createDeveloper();
  outsider = await createDeveloper();
  project = await createProject(manager, { members: [dev._id] });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/projects/:id/sprints', () => {
  it('lets the project manager create a PLANNED sprint', async () => {
    const res = await api.create(manager, project.id, { ...validSprint, status: 'ACTIVE' });

    expect(res.status).toBe(201);
    expect(res.body.sprint).toMatchObject({
      name: 'Sprint 1',
      objective: 'Authentication and catalog',
      project: project.id,
      status: 'PLANNED',
      startDate: '2026-10-05T00:00:00.000Z',
      endDate: '2026-10-18T00:00:00.000Z',
    });
  });

  it('returns 403 to a member and an admin, 404 to an outsider', async () => {
    expect((await api.create(dev, project.id, validSprint)).status).toBe(403);
    expect((await api.create(admin, project.id, validSprint)).status).toBe(403);
    expect((await api.create(outsider, project.id, validSprint)).status).toBe(404);
  });

  it.each([
    [{ ...validSprint, name: '' }, 'name', 'Sprint name is required'],
    [{ ...validSprint, endDate: undefined }, 'endDate', 'End date must be a valid date (YYYY-MM-DD)'],
    [{ ...validSprint, endDate: '2026-10-01' }, 'endDate', 'End date must be on or after the start date'],
  ])('returns 400 for invalid data (%#)', async (body, field, message) => {
    const res = await api.create(manager, project.id, body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, message }]);
  });

  it('returns 409 on an archived project', async () => {
    project.status = 'ARCHIVED';
    await project.save();

    expect((await api.create(manager, project.id, validSprint)).status).toBe(409);
  });
});

describe('GET sprints', () => {
  let s1;
  let s2;

  beforeEach(async () => {
    s2 = await createSprint(project, { name: 'Second', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-14') });
    s1 = await createSprint(project, { name: 'First', status: 'COMPLETED' });
    await createSprint(await createProject(manager), { name: 'Other project' });
  });

  it('lists the sprints of a project in chronological order', async () => {
    const res = await api.list(dev, project.id);

    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.name)).toEqual(['First', 'Second']);
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters by status', async () => {
    expect((await api.list(manager, project.id, '?status=COMPLETED')).body.data.map((s) => s.id)).toEqual([s1.id]);
  });

  it('returns a sprint to project viewers and 404 to outsiders', async () => {
    expect((await api.get(dev, s2.id)).body.sprint.name).toBe('Second');
    expect((await api.get(admin, s2.id)).status).toBe(200);
    expect((await api.get(outsider, s2.id)).status).toBe(404);
    expect((await api.list(outsider, project.id)).status).toBe(404);
  });
});

describe('PATCH /api/v1/sprints/:id', () => {
  it('lets the manager update an open sprint', async () => {
    const sprint = await createSprint(project);

    const res = await api.update(manager, sprint.id, { name: 'Renamed', endDate: '2026-02-20' });

    expect(res.status).toBe(200);
    expect(res.body.sprint).toMatchObject({ name: 'Renamed', endDate: '2026-02-20T00:00:00.000Z' });
  });

  it('refuses to modify a completed sprint', async () => {
    const sprint = await createSprint(project, { status: 'COMPLETED' });

    const res = await api.update(manager, sprint.id, { name: 'Renamed' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('The sprint is completed and can no longer be modified');
  });

  it('returns 403 to a member', async () => {
    const sprint = await createSprint(project);

    expect((await api.update(dev, sprint.id, { name: 'x' })).status).toBe(403);
  });

  it('returns 400 when no field is provided', async () => {
    const sprint = await createSprint(project);

    const res = await api.update(manager, sprint.id, { status: 'ACTIVE' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Provide at least one field to update: name, objective, startDate, endDate');
  });
});

describe('PATCH /api/v1/sprints/:id/status', () => {
  it('follows the lifecycle PLANNED → ACTIVE → COMPLETED and records completedAt', async () => {
    const sprint = await createSprint(project);

    expect((await api.status(manager, sprint.id, 'ACTIVE')).body.sprint.status).toBe('ACTIVE');
    const res = await api.status(manager, sprint.id, 'COMPLETED');

    expect(res.status).toBe(200);
    expect(res.body.sprint.status).toBe('COMPLETED');
    expect(Date.parse(res.body.sprint.completedAt)).not.toBeNaN();
  });

  it.each([
    ['PLANNED', 'COMPLETED'],
    ['COMPLETED', 'ACTIVE'],
    ['CANCELLED', 'PLANNED'],
  ])('refuses %s → %s (409)', async (from, to) => {
    const sprint = await createSprint(project, { status: from });

    const res = await api.status(manager, sprint.id, to);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(`Invalid status transition: ${from} → ${to}`);
  });

  it('allows only one active sprint per project', async () => {
    await createSprint(project, { name: 'Current', status: 'ACTIVE' });
    const next = await createSprint(project);

    const res = await api.status(manager, next.id, 'ACTIVE');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('The project already has an active sprint: Current');
  });

  it('enforces the single active sprint at database level', async () => {
    await createSprint(project, { status: 'ACTIVE' });

    await expect(createSprint(project, { status: 'ACTIVE' })).rejects.toMatchObject({ code: 11000 });
    await expect(createSprint(await createProject(manager), { status: 'ACTIVE' })).resolves.toBeDefined();
  });

  it('returns 400 for an unknown status and 403 for a member', async () => {
    const sprint = await createSprint(project);

    expect((await api.status(manager, sprint.id, 'DONE')).status).toBe(400);
    expect((await api.status(dev, sprint.id, 'ACTIVE')).status).toBe(403);
  });
});

describe('DELETE /api/v1/sprints/:id', () => {
  it('deletes a PLANNED sprint', async () => {
    const sprint = await createSprint(project);

    expect((await api.remove(manager, sprint.id)).status).toBe(204);
    expect(await Sprint.findById(sprint.id)).toBeNull();
  });

  it('refuses to delete a started sprint', async () => {
    const sprint = await createSprint(project, { status: 'ACTIVE' });

    const res = await api.remove(manager, sprint.id);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Only PLANNED sprints can be deleted; cancel this sprint instead');
  });

  it('prevents deleting a project that still has sprints', async () => {
    await createSprint(project);

    const res = await as(manager, request(app).delete(`/api/v1/projects/${project.id}`));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('The project still has sprints or tasks: archive it instead of deleting it');
  });
});
