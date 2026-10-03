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

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const answer = (overrides = {}) => ({
  riskLevel: 'HIGH',
  probability: 0.82,
  method: 'model',
  factors: [{ code: 'blocked_ratio', label: '2 blocked tasks (50% of the open tasks)', impact: 1.2 }],
  features: { elapsed_ratio: 0.5, progress_gap: 0.3 },
  model: { name: 'logistic regression (7 features, synthetic sprints)', version: 1, accuracy: 0.864, rocAuc: 0.934, f1: 0.861 },
  warnings: [],
  ...overrides,
});

let fetchMock;
let manager;
let dev;
let project;
let sprint;

const risk = (user, sprintId = sprint.id) =>
  request(app).get(`/api/v1/sprints/${sprintId}/ai/risk`).set('Authorization', bearer(user));
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeAll(startTestDatabase);
beforeEach(async () => {
  fetchMock = jest.spyOn(global, 'fetch');
  manager = await createManager();
  dev = await createDeveloper();
  const inactive = await createDeveloper({ isActive: false });
  project = await createProject(manager, { members: [dev._id, inactive._id] });
  sprint = await createSprint(project, {
    status: 'ACTIVE',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-14'),
  });
});
afterEach(async () => {
  fetchMock.mockRestore();
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('GET /api/v1/sprints/:id/ai/risk', () => {
  it('measures the sprint, sends it to the AI service and returns the validated risk', async () => {
    await createTask(project, { sprint: sprint._id, complexity: 5, status: 'DONE', assignee: dev._id });
    await createTask(project, { sprint: sprint._id, complexity: 8, status: 'BLOCKED', assignee: dev._id });
    await createTask(project, { sprint: sprint._id, complexity: 3 }); // open, unassigned
    await createTask(project, { complexity: 13 }); // backlog: not counted
    // Velocity of the previous completed sprint: 10 points in 10 days.
    const previous = await createSprint(project, {
      status: 'COMPLETED',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-10'),
    });
    await createTask(project, { sprint: previous._id, complexity: 8, status: 'DONE', assignee: dev._id });
    await createTask(project, { sprint: previous._id, complexity: 2, status: 'DONE', assignee: dev._id });
    fetchMock.mockResolvedValue(jsonResponse(200, answer()));

    const res = await risk(dev);

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/ai\/sprints\/predict-risk$/);
    const body = sent();
    expect(body.sprint).toEqual({ startDate: '2026-10-01', endDate: '2026-10-14', asOf: new Date().toISOString().slice(0, 10) });
    expect(body.tasks).toEqual({
      total: 3,
      done: 1,
      blocked: 1,
      highComplexityOpen: 1,
      unassignedOpen: 1,
      totalPoints: 16,
      donePoints: 5,
    });
    expect(body.team).toEqual({ size: 1, historicalVelocity: 1 }); // the deactivated member is not counted
    expect(res.body).toMatchObject({
      sprint: { id: sprint.id, name: sprint.name, status: 'ACTIVE' },
      riskLevel: 'HIGH',
      probability: 0.82,
      method: 'model',
      factors: [{ code: 'blocked_ratio', label: '2 blocked tasks (50% of the open tasks)', impact: 1.2 }],
      measures: { total: 3, teamSize: 1, historicalVelocity: 1 },
      model: { name: 'logistic regression (7 features, synthetic sprints)' },
    });
  });

  it('sends no historical velocity when the project has no completed sprint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, answer({ riskLevel: 'LOW', probability: 0, method: 'rule' })));
    const res = await risk(manager);
    expect(res.status).toBe(200);
    expect(sent().team.historicalVelocity).toBeNull();
    expect(sent().tasks.total).toBe(0);
  });

  it('is available to every project viewer, not to outsiders', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, answer()));
    expect((await risk(manager)).status).toBe(200);
    expect((await risk(await createAdmin())).status).toBe(200);
    expect((await risk(await createDeveloper())).status).toBe(404);
    expect((await risk(manager, 'bad-id')).status).toBe(400);
  });

  it('refuses closed sprints (409) without calling the AI service', async () => {
    sprint.status = 'COMPLETED';
    await sprint.save();
    const res = await risk(manager);
    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown level', { riskLevel: 'EXTREME' }],
    ['a probability above 1', { probability: 1.5 }],
    ['a malformed factor', { factors: [{ code: 'x', label: 42, impact: 1 }] }],
    ['a non-numeric feature', { features: { pace_ratio: 'high' } }],
    ['no model name', { model: {} }],
  ])('refuses an AI answer with %s (502)', async (_, overrides) => {
    fetchMock.mockResolvedValue(jsonResponse(200, answer(overrides)));
    const res = await risk(manager);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_ERROR');
  });

  it('reports a timeout of the AI service (504)', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    const res = await risk(manager);
    expect(res.status).toBe(504);
  });
});
