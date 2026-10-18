const request = require('supertest');
const { createApp } = require('../src/app');
const { Task } = require('../src/models/task.model');
const { Activity } = require('../src/models/activity.model');
const { SprintRetrospective } = require('../src/models/sprintRetrospective.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const {
  createManager,
  createDeveloper,
  createProject,
  createSprint,
  createTask,
  bearer,
} = require('./helpers/factories');

const app = createApp();

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const METRICS = {
  totalTasks: 4,
  doneTasks: 2,
  totalPoints: 18,
  donePoints: 8,
  completionRate: 0.444,
  durationDays: 14,
  velocity: 0.57,
  historicalVelocity: 1.0,
  velocityChange: -0.43,
  blockedTasks: 1,
  blockedDuringSprint: 2,
  addedAfterStart: 1,
  lateTasks: 1,
  unassignedOpen: 1,
};
const answer = (overrides = {}) => ({
  method: 'llm',
  model: 'gemini-test',
  summary: 'Sprint 2 delivered 2 of 4 tasks (8 of 18 points, 44%).',
  delivered: ['Login page'],
  slipped: ['Payment API (blocked: waiting for the bank)'],
  blockers: ['The bank API was not available'],
  wentWell: ['The login page was delivered'],
  toImprove: ['Only 44% of the points were delivered'],
  actions: [
    { title: 'Get the bank sandbox access', description: 'The payment API was blocked.', type: 'DEVOPS', priority: 'HIGH' },
    { title: 'Commit to about 8 points', description: 'Velocity 0.57 points/day.', type: 'IMPROVEMENT', priority: 'MEDIUM' },
  ],
  metrics: METRICS,
  warnings: [],
  ...overrides,
});

let fetchMock;
let reply;
let manager;
let dev;
let project;
let sprint;
let nextSprint;

const url = (sprintId = sprint.id) => `/api/v1/sprints/${sprintId}/ai/retrospective`;
const get = (user, sprintId) => request(app).get(url(sprintId)).set('Authorization', bearer(user));
const generate = (user, sprintId) => request(app).post(url(sprintId)).set('Authorization', bearer(user));
const toTask = (user, actionId, body = {}) =>
  request(app).post(`${url()}/actions/${actionId}/task`).set('Authorization', bearer(user)).send(body);
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);
// Mongoose keeps createdAt immutable: the tests set it through the driver.
const setCreatedAt = (task, date) => Task.collection.updateOne({ _id: task._id }, { $set: { createdAt: date } });

beforeAll(startTestDatabase);
beforeEach(async () => {
  reply = () => jsonResponse(200, answer());
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => reply());
  manager = await createManager({ firstName: 'Sara', lastName: 'Manager' });
  dev = await createDeveloper({ firstName: 'Bob', lastName: 'Martin' });
  const other = await createDeveloper({ firstName: 'Alice', lastName: 'Smith' });
  project = await createProject(manager, { name: 'Shop', members: [dev._id, other._id] });
  // A previous completed sprint: 14 points done in 14 days → historical velocity 1.0.
  const previous = await createSprint(project, {
    name: 'Sprint 1',
    status: 'COMPLETED',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-14'),
    completedAt: new Date('2026-09-14'),
  });
  await createTask(project, { sprint: previous._id, status: 'DONE', complexity: 13, assignee: dev._id });
  await createTask(project, { sprint: previous._id, status: 'DONE', complexity: 1, assignee: dev._id });

  sprint = await createSprint(project, {
    name: 'Sprint 2',
    objective: 'Checkout',
    status: 'COMPLETED',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-14'),
    completedAt: new Date('2026-10-14T17:00:00Z'),
  });
  nextSprint = await createSprint(project, { name: 'Sprint 3', startDate: new Date('2026-10-15'), endDate: new Date('2026-10-28') });

  const planned = new Date('2026-10-01T09:00:00Z');
  const login = await createTask(project, {
    title: 'Login page',
    sprint: sprint._id,
    status: 'DONE',
    complexity: 5,
    assignee: dev._id,
    deadline: new Date('2026-10-05'),
    completedAt: new Date('2026-10-07T10:00:00Z'), // after its deadline
  });
  const logout = await createTask(project, { title: 'Logout', sprint: sprint._id, status: 'DONE', complexity: 3, assignee: dev._id });
  const payment = await createTask(project, {
    title: 'Payment API',
    sprint: sprint._id,
    status: 'BLOCKED',
    complexity: 8,
    assignee: other._id,
    blockedReason: 'Waiting for the bank',
  });
  const refunds = await createTask(project, { title: 'Refunds', sprint: sprint._id, complexity: 2 });
  await Promise.all([login, logout, payment].map((task) => setCreatedAt(task, planned)));
  await setCreatedAt(refunds, new Date('2026-10-06T09:00:00Z')); // added after the start
  // Logout was blocked, then unblocked (history).
  await Activity.create({ project: project._id, actor: manager._id, type: 'TASK_STATUS_CHANGED', task: logout._id, details: { to: 'BLOCKED' } });
});
afterEach(async () => {
  fetchMock.mockRestore();
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('POST /api/v1/sprints/:id/ai/retrospective', () => {
  it('sends the facts of the sprint and saves the retrospective', async () => {
    const res = await generate(manager);

    expect(res.status).toBe(201);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/ai/sprints/retrospective');
    const facts = sent();
    expect(facts.sprint).toEqual({ name: 'Sprint 2', objective: 'Checkout', startDate: '2026-10-01', endDate: '2026-10-14' });
    expect(facts.historicalVelocity).toBe(1); // the previous sprint only, not this one
    expect(facts.tasks).toEqual([
      expect.objectContaining({ title: 'Login page', points: 5, status: 'DONE', assignee: 'Bob Martin', late: true, wasBlocked: false, addedAfterStart: false }),
      expect.objectContaining({ title: 'Logout', status: 'DONE', late: false, wasBlocked: true, addedAfterStart: false }),
      expect.objectContaining({ title: 'Payment API', status: 'BLOCKED', blockedReason: 'Waiting for the bank', assignee: 'Alice Smith' }),
      expect.objectContaining({ title: 'Refunds', status: 'TODO', assignee: null, blockedReason: null, addedAfterStart: true }),
    ]);
    expect(facts.team).toEqual(
      expect.arrayContaining([
        { name: 'Bob Martin', donePoints: 8, openPoints: 0 },
        { name: 'Alice Smith', donePoints: 0, openPoints: 8 },
      ]),
    );

    const retro = res.body.retrospective;
    expect(retro).toMatchObject({
      method: 'llm',
      model: 'gemini-test',
      summary: answer().summary,
      slipped: ['Payment API (blocked: waiting for the bank)'],
      metrics: METRICS,
      sprint: { id: sprint.id, name: 'Sprint 2', status: 'COMPLETED' },
      generatedBy: { firstName: 'Sara', lastName: 'Manager' },
    });
    expect(retro.actions[0]).toMatchObject({ title: 'Get the bank sandbox access', type: 'DEVOPS', priority: 'HIGH', task: null });
    expect(retro.actions[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await SprintRetrospective.countDocuments()).toBe(1);
  });

  it('replaces the retrospective when it is regenerated', async () => {
    await generate(manager);
    reply = () => jsonResponse(200, answer({ method: 'local', model: null, summary: 'Rules summary.' }));
    const res = await generate(manager);
    expect(res.status).toBe(201);
    expect(res.body.retrospective).toMatchObject({ method: 'local', model: null, summary: 'Rules summary.' });
    expect(await SprintRetrospective.countDocuments()).toBe(1);
  });

  it('is reserved to the manager, for a completed sprint', async () => {
    expect((await generate(dev)).status).toBe(403);
    expect((await generate(manager, nextSprint.id)).status).toBe(409);
    expect((await generate(manager, '507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await generate(manager, 'nope')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no summary', { summary: ' ' }],
    ['unknown method', { method: 'magic' }],
    ['too many actions', { actions: Array(6).fill(answer().actions[0]) }],
    ['invalid action type', { actions: [{ ...answer().actions[0], type: 'MEETING' }] }],
    ['too long item', { delivered: ['x'.repeat(301)] }],
    ['wrong metric', { metrics: { ...METRICS, completionRate: 2 } }],
  ])('refuses an invalid AI answer (%s) and saves nothing', async (_name, overrides) => {
    reply = () => jsonResponse(200, answer(overrides));
    const res = await generate(manager);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_ERROR');
    expect(await SprintRetrospective.countDocuments()).toBe(0);
  });
});

describe('GET /api/v1/sprints/:id/ai/retrospective', () => {
  it('returns null, then the saved retrospective, to every project viewer', async () => {
    expect((await get(dev)).body).toEqual({ retrospective: null });
    await generate(manager);
    const res = await get(dev);
    expect(res.status).toBe(200);
    expect(res.body.retrospective.summary).toBe(answer().summary);
    const outsider = await createDeveloper();
    expect((await get(outsider)).status).toBe(404);
  });
});

describe('POST /api/v1/sprints/:id/ai/retrospective/actions/:actionId/task', () => {
  it('creates a task from an action once, in an open sprint or in the backlog', async () => {
    const { actions } = (await generate(manager)).body.retrospective;

    let res = await toTask(manager, actions[0].id, { sprint: nextSprint.id });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Get the bank sandbox access',
      type: 'DEVOPS',
      priority: 'HIGH',
      sprint: nextSprint.id,
      description: 'The payment API was blocked.\n\nFrom the retrospective of «Sprint 2».',
    });
    expect(res.body.retrospective.actions[0].task).toBe(res.body.task.id);
    expect(await Activity.countDocuments({ type: 'TASK_CREATED' })).toBe(1);
    expect((await toTask(manager, actions[0].id)).status).toBe(409);

    res = await toTask(manager, actions[1].id, { sprint: null });
    expect(res.status).toBe(201);
    expect(res.body.task.sprint).toBeNull();
  });

  it('releases the action when the task cannot be created', async () => {
    const { actions } = (await generate(manager)).body.retrospective;
    // The completed sprint itself: no task can be added to it.
    expect((await toTask(manager, actions[0].id, { sprint: sprint.id })).status).toBe(409);
    const res = await toTask(manager, actions[0].id);
    expect(res.status).toBe(201);
    expect(res.body.task.sprint).toBeNull();
  });

  it('validates the request and is reserved to the manager', async () => {
    const { actions } = (await generate(manager)).body.retrospective;
    expect((await toTask(dev, actions[0].id)).status).toBe(403);
    expect((await toTask(manager, 'not-a-uuid')).status).toBe(400);
    expect((await toTask(manager, actions[0].id, { sprint: 'x' })).status).toBe(400);
    expect((await toTask(manager, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect(await Task.countDocuments({ title: 'Get the bank sandbox access' })).toBe(0);
  });
});
