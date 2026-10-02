const request = require('supertest');
const { createApp } = require('../src/app');
const { Task } = require('../src/models/task.model');
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

let admin;
let manager;
let dev;
let dev2;
let outsider;
let project;

const as = (user, req) => req.set('Authorization', bearer(user));
const api = {
  create: (user, body, projectId = project.id) =>
    as(user, request(app).post(`/api/v1/projects/${projectId}/tasks`).send(body)),
  list: (user, query = '') => as(user, request(app).get(`/api/v1/projects/${project.id}/tasks${query}`)),
  board: (user, query = '') => as(user, request(app).get(`/api/v1/projects/${project.id}/board${query}`)),
  mine: (user, query = '') => as(user, request(app).get(`/api/v1/tasks/assigned${query}`)),
  get: (user, id) => as(user, request(app).get(`/api/v1/tasks/${id}`)),
  update: (user, id, body) => as(user, request(app).patch(`/api/v1/tasks/${id}`).send(body)),
  status: (user, id, body) => as(user, request(app).patch(`/api/v1/tasks/${id}/status`).send(body)),
  assign: (user, id, assigneeId) =>
    as(user, request(app).patch(`/api/v1/tasks/${id}/assignee`).send({ assigneeId })),
  remove: (user, id) => as(user, request(app).delete(`/api/v1/tasks/${id}`)),
};

const validTask = {
  title: 'Implement login page',
  description: 'Reactive form with validation',
  type: 'FEATURE',
  priority: 'HIGH',
  complexity: 5,
  deadline: '2026-11-15',
  requiredSkills: ['Angular', ' TypeScript '],
};

beforeAll(startTestDatabase);
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  dev = await createDeveloper();
  dev2 = await createDeveloper();
  outsider = await createDeveloper();
  project = await createProject(manager, { members: [dev._id, dev2._id] });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/projects/:id/tasks', () => {
  it('creates a TODO task in the backlog, created by the manager', async () => {
    const res = await api.create(manager, validTask);

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Implement login page',
      type: 'FEATURE',
      priority: 'HIGH',
      complexity: 5,
      status: 'TODO',
      requiredSkills: ['Angular', 'TypeScript'],
      deadline: '2026-11-15T00:00:00.000Z',
      project: project.id,
      sprint: null,
      assignee: null,
      createdBy: { id: manager.id, email: manager.email },
      isOverdue: false,
    });
  });

  it('applies defaults (FEATURE, MEDIUM, 3 points)', async () => {
    const res = await api.create(manager, { title: 'Minimal' });

    expect(res.body.task).toMatchObject({ type: 'FEATURE', priority: 'MEDIUM', complexity: 3, requiredSkills: [] });
  });

  it('can plan the task in an open sprint and assign it to a member', async () => {
    const sprint = await createSprint(project);

    const res = await api.create(manager, { ...validTask, sprint: sprint.id, assignee: dev.id });

    expect(res.status).toBe(201);
    expect(res.body.task.sprint).toBe(sprint.id);
    expect(res.body.task.assignee).toMatchObject({ id: dev.id });
  });

  it('refuses a sprint of another project, a closed sprint and a non-member assignee', async () => {
    const foreignSprint = await createSprint(await createProject(manager));
    const closedSprint = await createSprint(project, { status: 'COMPLETED' });

    const foreign = await api.create(manager, { ...validTask, sprint: foreignSprint.id });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.details).toEqual([{ field: 'sprint', message: 'Sprint not found in this project' }]);

    const closed = await api.create(manager, { ...validTask, sprint: closedSprint.id });
    expect(closed.status).toBe(409);
    expect(closed.body.error.message).toBe('Tasks cannot be added to a completed sprint');

    const nonMember = await api.create(manager, { ...validTask, assignee: outsider.id });
    expect(nonMember.body.error.details).toEqual([
      { field: 'assignee', message: 'The assignee must be a member of the project' },
    ]);
  });

  it.each([
    [{ ...validTask, title: '' }, 'title', 'Title is required'],
    [{ ...validTask, type: 'EPIC' }, 'type', 'Type must be one of: FEATURE, BUG, IMPROVEMENT, TESTING, DOCUMENTATION, DEVOPS, SECURITY'],
    [{ ...validTask, priority: 'URGENT' }, 'priority', 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL'],
    [{ ...validTask, complexity: 4 }, 'complexity', 'Complexity must be one of (story points): 1, 2, 3, 5, 8, 13'],
    [{ ...validTask, sprint: 'abc' }, 'sprint', 'Sprint must be a valid id or null'],
  ])('returns 400 for invalid data (%#)', async (body, field, message) => {
    const res = await api.create(manager, body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, message }]);
  });

  it('returns 403 to members and admins, 404 to outsiders', async () => {
    expect((await api.create(dev, validTask)).status).toBe(403);
    expect((await api.create(admin, validTask)).status).toBe(403);
    expect((await api.create(outsider, validTask)).status).toBe(404);
  });
});

describe('GET /api/v1/projects/:id/tasks', () => {
  let sprint;

  beforeEach(async () => {
    sprint = await createSprint(project);
    await createTask(project, { title: 'Login API', priority: 'HIGH', assignee: dev._id, sprint: sprint._id });
    await createTask(project, { title: 'Fix cart bug', type: 'BUG', status: 'BLOCKED' });
    await createTask(project, {
      title: 'Old task',
      deadline: new Date('2020-01-01'),
      assignee: dev2._id,
      status: 'IN_PROGRESS',
    });
    await createTask(project, { title: 'Done task', deadline: new Date('2020-01-01'), status: 'DONE', assignee: dev._id });
  });

  const titles = (res) => res.body.data.map((task) => task.title).sort();

  it('lists the tasks of the project to its members', async () => {
    const res = await api.list(dev);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);
  });

  it.each([
    ['?status=BLOCKED', ['Fix cart bug']],
    ['?priority=HIGH', ['Login API']],
    ['?type=BUG', ['Fix cart bug']],
    ['?search=login', ['Login API']],
    ['?overdue=true', ['Old task']],
  ])('filters %s', async (query, expected) => {
    expect(titles(await api.list(manager, query))).toEqual(expected);
  });

  it('filters by assignee (id or "unassigned") and by sprint (id or "backlog")', async () => {
    expect(titles(await api.list(manager, `?assignee=${dev.id}`))).toEqual(['Done task', 'Login API']);
    expect(titles(await api.list(manager, '?assignee=unassigned'))).toEqual(['Fix cart bug']);
    expect(titles(await api.list(manager, `?sprint=${sprint.id}`))).toEqual(['Login API']);
    expect(titles(await api.list(manager, '?sprint=backlog'))).toEqual(['Done task', 'Fix cart bug', 'Old task']);
  });

  it('flags overdue tasks (deadline passed and not DONE)', async () => {
    const res = await api.list(manager);
    const byTitle = Object.fromEntries(res.body.data.map((task) => [task.title, task.isOverdue]));

    expect(byTitle).toMatchObject({ 'Old task': true, 'Done task': false, 'Login API': false });
  });

  it('returns 400 for invalid filters and 404 to outsiders', async () => {
    expect((await api.list(manager, '?sprint=current')).status).toBe(400);
    expect((await api.list(outsider)).status).toBe(404);
  });
});

describe('GET / PATCH / DELETE /api/v1/tasks/:id', () => {
  let task;

  beforeEach(async () => {
    task = await createTask(project, { assignee: dev._id });
  });

  it('returns the task to project viewers only', async () => {
    expect((await api.get(dev2, task.id)).body.task.id).toBe(task.id);
    expect((await api.get(admin, task.id)).status).toBe(200);
    expect((await api.get(outsider, task.id)).status).toBe(404);
  });

  it('lets the manager update fields, move the task to a sprint and back to the backlog', async () => {
    const sprint = await createSprint(project);

    const moved = await api.update(manager, task.id, { title: 'Renamed', priority: 'CRITICAL', sprint: sprint.id });
    expect(moved.status).toBe(200);
    expect(moved.body.task).toMatchObject({ title: 'Renamed', priority: 'CRITICAL', sprint: sprint.id });

    const backlog = await api.update(manager, task.id, { sprint: null, deadline: null });
    expect(backlog.body.task.sprint).toBeNull();
    expect(backlog.body.task.deadline).toBeUndefined();
  });

  it('ignores status/assignee in a field update and refuses an empty update', async () => {
    const res = await api.update(manager, task.id, { status: 'DONE', assignee: dev2.id });

    expect(res.status).toBe(400);
  });

  it('only lets the manager update and delete', async () => {
    expect((await api.update(dev, task.id, { title: 'x' })).status).toBe(403);
    expect((await api.remove(dev, task.id)).status).toBe(403);

    expect((await api.remove(manager, task.id)).status).toBe(204);
    expect(await Task.findById(task.id)).toBeNull();
  });
});

describe('PATCH /api/v1/tasks/:id/status (workflow)', () => {
  it('lets the assignee move their task through the whole workflow', async () => {
    const task = await createTask(project, { assignee: dev._id });

    for (const status of ['IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE']) {
      const res = await api.status(dev, task.id, { status });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe(status);
    }
    expect((await Task.findById(task.id)).completedAt).toBeInstanceOf(Date);
  });

  it('refuses transitions that skip workflow steps', async () => {
    const task = await createTask(project, { assignee: dev._id });

    const res = await api.status(dev, task.id, { status: 'DONE' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Invalid status transition: TODO → DONE');
  });

  it('blocks with a reason, and unblocking clears the reason', async () => {
    const task = await createTask(project, { assignee: dev._id, status: 'IN_PROGRESS' });

    const blocked = await api.status(dev, task.id, { status: 'BLOCKED', blockedReason: 'Waiting for API keys' });
    expect(blocked.body.task).toMatchObject({ status: 'BLOCKED', blockedReason: 'Waiting for API keys' });

    const unblocked = await api.status(dev, task.id, { status: 'IN_PROGRESS' });
    expect(unblocked.body.task.status).toBe('IN_PROGRESS');
    expect(unblocked.body.task.blockedReason).toBeUndefined();
  });

  it('reopens a DONE task and clears completedAt', async () => {
    const task = await createTask(project, { assignee: dev._id, status: 'DONE', completedAt: new Date() });

    const res = await api.status(manager, task.id, { status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.task.completedAt).toBeUndefined();
  });

  it('requires an assignee before starting a task', async () => {
    const task = await createTask(project);

    const res = await api.status(manager, task.id, { status: 'IN_PROGRESS' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Assign the task to a developer before moving it to IN_PROGRESS');
  });

  it('refuses other developers and admins (403), and outsiders (404)', async () => {
    const task = await createTask(project, { assignee: dev._id });

    expect((await api.status(dev2, task.id, { status: 'IN_PROGRESS' })).status).toBe(403);
    expect((await api.status(admin, task.id, { status: 'IN_PROGRESS' })).status).toBe(403);
    expect((await api.status(outsider, task.id, { status: 'IN_PROGRESS' })).status).toBe(404);
  });

  it('returns 400 for an unknown status', async () => {
    const task = await createTask(project, { assignee: dev._id });

    expect((await api.status(dev, task.id, { status: 'REVIEW' })).status).toBe(400);
  });
});

describe('PATCH /api/v1/tasks/:id/assignee', () => {
  it('assigns, reassigns and unassigns a TODO task', async () => {
    const task = await createTask(project);

    expect((await api.assign(manager, task.id, dev.id)).body.task.assignee.id).toBe(dev.id);
    expect((await api.assign(manager, task.id, dev2.id)).body.task.assignee.id).toBe(dev2.id);
    expect((await api.assign(manager, task.id, null)).body.task.assignee).toBeNull();
  });

  it('refuses to unassign a task in progress', async () => {
    const task = await createTask(project, { assignee: dev._id, status: 'IN_PROGRESS' });

    const res = await api.assign(manager, task.id, null);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('A task in IN_PROGRESS must keep an assignee: move it back to TODO first');
  });

  it('refuses non-members and deactivated members', async () => {
    const task = await createTask(project);
    const inactive = await createDeveloper({ isActive: false });
    project.members.push(inactive._id);
    await project.save();

    expect((await api.assign(manager, task.id, outsider.id)).status).toBe(400);
    expect((await api.assign(manager, task.id, inactive.id)).body.error.details).toEqual([
      { field: 'assignee', message: 'The assignee account is deactivated' },
    ]);
  });

  it('requires assigneeId (id or null) and is reserved to the manager', async () => {
    const task = await createTask(project);

    expect((await as(manager, request(app).patch(`/api/v1/tasks/${task.id}/assignee`).send({}))).status).toBe(400);
    expect((await api.assign(dev, task.id, dev.id)).status).toBe(403);
  });
});

describe('GET /api/v1/projects/:id/board (Kanban)', () => {
  it('groups tasks by workflow column (+ BLOCKED), ordered by priority then age', async () => {
    const sprint = await createSprint(project, { name: 'Sprint A', status: 'ACTIVE' });
    await createTask(project, { title: 'Low', priority: 'LOW', sprint: sprint._id });
    await createTask(project, { title: 'Critical', priority: 'CRITICAL', sprint: sprint._id });
    await createTask(project, { title: 'Review', status: 'CODE_REVIEW', assignee: dev._id, sprint: sprint._id });
    await createTask(project, { title: 'Stuck', status: 'BLOCKED', sprint: sprint._id });
    await createTask(project, { title: 'Backlog item' });

    const res = await api.board(dev, `?sprint=${sprint.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      scope: 'SPRINT',
      sprint: { id: sprint.id, name: 'Sprint A', status: 'ACTIVE' },
      totalTasks: 4,
    });
    const columns = Object.fromEntries(res.body.columns.map((c) => [c.status, c.tasks.map((t) => t.title)]));
    expect(res.body.columns.map((c) => c.status)).toEqual(['TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE', 'BLOCKED']);
    expect(columns).toEqual({
      TODO: ['Critical', 'Low'],
      IN_PROGRESS: [],
      CODE_REVIEW: ['Review'],
      TESTING: [],
      DONE: [],
      BLOCKED: ['Stuck'],
    });
    expect(res.body.columns[0].count).toBe(2);

    const backlog = await api.board(dev, '?sprint=backlog');
    expect(backlog.body).toMatchObject({ scope: 'BACKLOG', totalTasks: 1, sprint: null });

    const all = await api.board(manager);
    expect(all.body).toMatchObject({ scope: 'ALL', totalTasks: 5 });
  });

  it('returns 404 for a sprint of another project', async () => {
    const foreignSprint = await createSprint(await createProject(manager));

    expect((await api.board(manager, `?sprint=${foreignSprint.id}`)).status).toBe(404);
  });
});

describe('GET /api/v1/tasks/assigned', () => {
  it('lists my tasks across projects, by deadline (none last), with project and sprint names', async () => {
    const otherProject = await createProject(manager, { name: 'Other', members: [dev._id] });
    const sprint = await createSprint(project, { name: 'Sprint X' });
    await createTask(project, { title: 'No deadline', assignee: dev._id });
    await createTask(otherProject, { title: 'Later', assignee: dev._id, deadline: new Date('2027-06-01') });
    await createTask(project, { title: 'Sooner', assignee: dev._id, deadline: new Date('2027-01-01'), sprint: sprint._id });
    await createTask(project, { title: 'Not mine', assignee: dev2._id });

    const res = await api.mine(dev);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.title)).toEqual(['Sooner', 'Later', 'No deadline']);
    expect(res.body.data[0]).toMatchObject({
      project: { name: project.name },
      sprint: { name: 'Sprint X' },
    });
    expect(res.body.pagination.total).toBe(3);
  });

  it('filters by status and hides projects the user no longer belongs to', async () => {
    await createTask(project, { title: 'Done', assignee: dev._id, status: 'DONE' });
    const formerProject = await createProject(manager);
    await createTask(formerProject, { title: 'Former', assignee: dev._id, status: 'DONE' });

    const res = await api.mine(dev, '?status=DONE');

    expect(res.body.data.map((t) => t.title)).toEqual(['Done']);
  });
});

describe('Sprint statistics and guards', () => {
  it('computes sprint statistics in story points', async () => {
    const sprint = await createSprint(project);
    await createTask(project, { sprint: sprint._id, complexity: 5, status: 'DONE', assignee: dev._id });
    await createTask(project, { sprint: sprint._id, complexity: 3, status: 'BLOCKED' });
    await createTask(project, { sprint: sprint._id, complexity: 2 });

    const res = await as(dev, request(app).get(`/api/v1/sprints/${sprint.id}`));

    expect(res.body.sprint.stats).toMatchObject({
      totalTasks: 3,
      completedTasks: 1,
      blockedTasks: 1,
      totalPoints: 10,
      completedPoints: 5,
      progress: 50,
      tasksByStatus: { TODO: 1, IN_PROGRESS: 0, CODE_REVIEW: 0, TESTING: 0, DONE: 1, BLOCKED: 1 },
    });

    const list = await as(dev, request(app).get(`/api/v1/projects/${project.id}/sprints`));
    expect(list.body.data[0].stats.totalPoints).toBe(10);
  });

  it('moves the tasks of a deleted sprint back to the backlog', async () => {
    const sprint = await createSprint(project);
    const task = await createTask(project, { sprint: sprint._id });

    await as(manager, request(app).delete(`/api/v1/sprints/${sprint.id}`));

    expect((await Task.findById(task.id)).sprint).toBeNull();
  });

  it('refuses to remove a member who still has unfinished tasks', async () => {
    await createTask(project, { assignee: dev._id, status: 'IN_PROGRESS' });
    await createTask(project, { assignee: dev._id, status: 'DONE' });

    const res = await as(manager, request(app).delete(`/api/v1/projects/${project.id}/members/${dev.id}`));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('This member still has 1 unfinished task(s) assigned: reassign them first');
  });

  it('refuses to delete a project that has tasks', async () => {
    await createTask(project);

    const res = await as(manager, request(app).delete(`/api/v1/projects/${project.id}`));

    expect(res.status).toBe(409);
  });

  it('makes tasks of an archived project read-only', async () => {
    const task = await createTask(project, { assignee: dev._id });
    project.status = 'ARCHIVED';
    await project.save();

    expect((await api.status(dev, task.id, { status: 'IN_PROGRESS' })).status).toBe(409);
    expect((await api.update(manager, task.id, { title: 'x' })).status).toBe(409);
    expect((await api.get(dev, task.id)).status).toBe(200);
  });
});
