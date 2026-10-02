const request = require('supertest');
const { createApp } = require('../src/app');
const { Project } = require('../src/models/project.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createAdmin, createManager, createDeveloper, createProject, bearer } = require('./helpers/factories');

const app = createApp();
const UNKNOWN_ID = '507f1f77bcf86cd799439011';

let admin;
let manager;
let otherManager;
let dev;
let outsider;

const as = (user, req) => req.set('Authorization', bearer(user));
const api = {
  list: (user, query = '') => as(user, request(app).get(`/api/v1/projects${query}`)),
  create: (user, body) => as(user, request(app).post('/api/v1/projects').send(body)),
  get: (user, id) => as(user, request(app).get(`/api/v1/projects/${id}`)),
  update: (user, id, body) => as(user, request(app).patch(`/api/v1/projects/${id}`).send(body)),
  remove: (user, id) => as(user, request(app).delete(`/api/v1/projects/${id}`)),
  addMember: (user, id, userId) => as(user, request(app).post(`/api/v1/projects/${id}/members`).send({ userId })),
  removeMember: (user, id, userId) => as(user, request(app).delete(`/api/v1/projects/${id}/members/${userId}`)),
};

const validProject = {
  name: 'E-commerce platform',
  description: 'Online shop with Stripe payment',
  startDate: '2026-10-01',
  deadline: '2027-01-31',
  technologies: ['Angular', ' Node.js ', 'MongoDB'],
};

beforeAll(startTestDatabase);
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  otherManager = await createManager();
  dev = await createDeveloper();
  outsider = await createDeveloper();
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/projects', () => {
  it('lets a project manager create a project they manage, with status PLANNING', async () => {
    const res = await api.create(manager, validProject);

    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({
      name: 'E-commerce platform',
      status: 'PLANNING',
      technologies: ['Angular', 'Node.js', 'MongoDB'],
      startDate: '2026-10-01T00:00:00.000Z',
      deadline: '2027-01-31T00:00:00.000Z',
      members: [],
      manager: { id: manager.id, email: manager.email },
    });
    expect(res.body.project.id).toBeDefined();
    expect(res.body.project.manager.password).toBeUndefined();
  });

  it.each([
    ['an ADMIN', () => admin],
    ['a DEVELOPER', () => dev],
  ])('returns 403 for %s', async (_label, getUser) => {
    const res = await api.create(getUser(), validProject);

    expect(res.status).toBe(403);
  });

  it('ignores the manager and members sent in the body', async () => {
    const res = await api.create(manager, { ...validProject, manager: otherManager.id, members: [dev.id] });

    expect(res.body.project.manager.id).toBe(manager.id);
    expect(res.body.project.members).toEqual([]);
  });

  it.each([
    [{ ...validProject, name: ' ' }, 'name', 'Project name is required'],
    [{ ...validProject, startDate: undefined }, 'startDate', 'Start date must be a valid date (YYYY-MM-DD)'],
    [{ ...validProject, startDate: '01/10/2026' }, 'startDate', 'Start date must be a valid date (YYYY-MM-DD)'],
    [{ ...validProject, status: 'DONE' }, 'status', 'Status must be one of: PLANNING, ACTIVE, PAUSED, COMPLETED, ARCHIVED'],
    [{ ...validProject, technologies: ['Angular', 'angular'] }, 'technologies', 'Duplicate value in technologies: angular'],
    [{ ...validProject, technologies: 'Angular' }, 'technologies', 'technologies must be an array of at most 30 items'],
  ])('returns 400 for an invalid field (%#)', async (body, field, message) => {
    const res = await api.create(manager, body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, message }]);
  });

  it('returns 400 when the deadline is before the start date', async () => {
    const res = await api.create(manager, { ...validProject, deadline: '2026-09-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'deadline', message: 'Deadline must be on or after the start date' }]);
  });

  it('refuses to create an archived project', async () => {
    const res = await api.create(manager, { ...validProject, status: 'ARCHIVED' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/projects', () => {
  let managed;
  let otherProject;

  beforeEach(async () => {
    managed = await createProject(manager, { name: 'Alpha', members: [dev._id] });
    otherProject = await createProject(otherManager, { name: 'Beta', status: 'ACTIVE' });
  });

  it('shows a project manager only the projects they manage', async () => {
    const res = await api.list(manager);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.name)).toEqual(['Alpha']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('shows a developer only the projects they are a member of', async () => {
    expect((await api.list(dev)).body.data.map((p) => p.name)).toEqual(['Alpha']);
    expect((await api.list(outsider)).body.data).toEqual([]);
  });

  it('shows an admin every project, newest first', async () => {
    const res = await api.list(admin);

    expect(res.body.data.map((p) => p.id)).toEqual([otherProject.id, managed.id]);
  });

  it('filters by status and searches by name', async () => {
    expect((await api.list(admin, '?status=ACTIVE')).body.data.map((p) => p.name)).toEqual(['Beta']);
    expect((await api.list(admin, '?search=alp')).body.data.map((p) => p.name)).toEqual(['Alpha']);
  });

  it('returns 400 for an invalid status filter', async () => {
    expect((await api.list(admin, '?status=OPEN')).status).toBe(400);
  });
});

describe('GET /api/v1/projects/:id', () => {
  let project;

  beforeEach(async () => {
    project = await createProject(manager, { members: [dev._id] });
  });

  it.each([
    ['the manager', () => manager],
    ['a member', () => dev],
    ['an admin', () => admin],
  ])('returns the project to %s, with populated members', async (_label, getUser) => {
    const res = await api.get(getUser(), project.id);

    expect(res.status).toBe(200);
    expect(res.body.project.members).toEqual([
      expect.objectContaining({ id: dev.id, firstName: dev.firstName, skills: [], isActive: true }),
    ]);
  });

  it('returns 404 to a user who is not involved (existence not revealed)', async () => {
    expect((await api.get(outsider, project.id)).status).toBe(404);
    expect((await api.get(otherManager, project.id)).status).toBe(404);
  });

  it('returns 404 for an unknown id and 400 for an invalid id', async () => {
    expect((await api.get(manager, UNKNOWN_ID)).status).toBe(404);
    expect((await api.get(manager, 'abc')).body.error.details).toEqual([{ field: 'id', message: 'Invalid project id' }]);
  });
});

describe('PATCH /api/v1/projects/:id', () => {
  let project;

  beforeEach(async () => {
    project = await createProject(manager, { members: [dev._id], deadline: new Date('2026-12-31') });
  });

  it('lets the manager update fields and status', async () => {
    const res = await api.update(manager, project.id, { name: 'Renamed', status: 'ACTIVE', technologies: ['Python'] });

    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({ name: 'Renamed', status: 'ACTIVE', technologies: ['Python'] });
  });

  it('removes the deadline with null', async () => {
    const res = await api.update(manager, project.id, { deadline: null });

    expect(res.status).toBe(200);
    expect(res.body.project.deadline).toBeUndefined();
  });

  it('checks the dates against the stored values', async () => {
    const res = await api.update(manager, project.id, { startDate: '2027-02-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('deadline');
  });

  it('returns 403 to a member and an admin, 404 to an outsider', async () => {
    expect((await api.update(dev, project.id, { name: 'x' })).status).toBe(403);
    expect((await api.update(admin, project.id, { name: 'x' })).status).toBe(403);
    expect((await api.update(outsider, project.id, { name: 'x' })).status).toBe(404);
  });

  it('returns 400 when no field is provided', async () => {
    const res = await api.update(manager, project.id, { manager: otherManager.id });

    expect(res.status).toBe(400);
  });

  it('only accepts a status change on an archived project', async () => {
    await api.update(manager, project.id, { status: 'ARCHIVED' });

    const rename = await api.update(manager, project.id, { name: 'New name' });
    expect(rename.status).toBe(409);
    expect(rename.body.error.message).toBe('The project is archived: change its status before modifying it');

    const unarchive = await api.update(manager, project.id, { status: 'ACTIVE' });
    expect(unarchive.status).toBe(200);
    expect(unarchive.body.project.status).toBe('ACTIVE');
  });
});

describe('DELETE /api/v1/projects/:id', () => {
  it('lets the manager delete the project (204)', async () => {
    const project = await createProject(manager);

    const res = await api.remove(manager, project.id);

    expect(res.status).toBe(204);
    expect(await Project.findById(project.id)).toBeNull();
  });

  it('returns 403 to a member', async () => {
    const project = await createProject(manager, { members: [dev._id] });

    expect((await api.remove(dev, project.id)).status).toBe(403);
    expect(await Project.findById(project.id)).not.toBeNull();
  });
});

describe('Project members', () => {
  let project;

  beforeEach(async () => {
    project = await createProject(manager);
  });

  it('adds a developer to the team (201) and gives them access', async () => {
    const res = await api.addMember(manager, project.id, dev.id);

    expect(res.status).toBe(201);
    expect(res.body.project.members.map((m) => m.id)).toEqual([dev.id]);
    expect((await api.get(dev, project.id)).status).toBe(200);
  });

  it('returns 409 when the developer is already a member', async () => {
    await api.addMember(manager, project.id, dev.id);

    const res = await api.addMember(manager, project.id, dev.id);

    expect(res.status).toBe(409);
  });

  it('refuses non-developers, deactivated accounts and unknown users', async () => {
    const inactive = await createDeveloper({ isActive: false });

    expect((await api.addMember(manager, project.id, otherManager.id)).body.error.message).toBe(
      'Only DEVELOPER accounts can be added as project members',
    );
    expect((await api.addMember(manager, project.id, inactive.id)).body.error.message).toBe(
      'This user account is deactivated',
    );
    expect((await api.addMember(manager, project.id, UNKNOWN_ID)).status).toBe(404);
    expect((await api.addMember(manager, project.id, 'abc')).status).toBe(400);
  });

  it('only lets the manager manage members', async () => {
    await api.addMember(manager, project.id, dev.id);

    expect((await api.addMember(dev, project.id, outsider.id)).status).toBe(403);
    expect((await api.removeMember(dev, project.id, dev.id)).status).toBe(403);
  });

  it('removes a member, who then loses access', async () => {
    await api.addMember(manager, project.id, dev.id);

    const res = await api.removeMember(manager, project.id, dev.id);

    expect(res.status).toBe(200);
    expect(res.body.project.members).toEqual([]);
    expect((await api.get(dev, project.id)).status).toBe(404);
  });

  it('returns 404 when removing a user who is not a member', async () => {
    expect((await api.removeMember(manager, project.id, dev.id)).status).toBe(404);
  });

  it('refuses member changes on an archived project', async () => {
    await api.update(manager, project.id, { status: 'ARCHIVED' });

    expect((await api.addMember(manager, project.id, dev.id)).status).toBe(409);
  });
});
