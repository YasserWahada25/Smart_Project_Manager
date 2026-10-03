const request = require('supertest');
const { createApp } = require('../src/app');
const { PROJECT_STATUSES } = require('../src/models/project.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const {
  createAdmin,
  createManager,
  createDeveloper,
  createProject,
  createTask,
  bearer,
} = require('./helpers/factories');

const app = createApp();

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock;
let manager;
let alice;
let bob;
let project;
let task;

const recommend = (user, taskId = task.id) =>
  request(app).get(`/api/v1/tasks/${taskId}/ai/recommendations`).set('Authorization', bearer(user));
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);

const item = (id, overrides = {}) => ({
  id: String(id),
  score: 80,
  matchingSkills: ['Angular'],
  missingSkills: [],
  similarCompletedTasks: 1,
  breakdown: { skills: 0.85, workload: 0.9, experience: 0.2 },
  explanation: 'Has 1 of 1 skills: Angular (advanced).',
  ...overrides,
});
const answer = (recommendations, overrides = {}) => ({
  method: 'scoring',
  model: 'transparent scoring v1',
  skillsSource: 'required',
  skills: ['Angular'],
  recommendations,
  warnings: [],
  ...overrides,
});

beforeAll(startTestDatabase);
beforeEach(async () => {
  fetchMock = jest.spyOn(global, 'fetch');
  manager = await createManager();
  alice = await createDeveloper({
    firstName: 'Alice',
    jobTitle: 'Frontend developer',
    skills: [{ name: 'Angular', level: 'EXPERT', yearsOfExperience: 4 }],
  });
  bob = await createDeveloper({ firstName: 'Bob', skills: [{ name: 'Node.js', level: 'INTERMEDIATE' }] });
  const inactive = await createDeveloper({ isActive: false });
  project = await createProject(manager, { members: [alice._id, bob._id, inactive._id] });
  task = await createTask(project, { title: 'Login page', type: 'FEATURE', complexity: 5, requiredSkills: ['Angular'] });
});
afterEach(async () => {
  fetchMock.mockRestore();
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('GET /api/v1/tasks/:id/ai/recommendations', () => {
  it('sends the task and the active members with their workload and experience, and returns the ranking', async () => {
    const other = await createProject(manager, { members: [alice._id] });
    await createTask(project, { assignee: alice._id, complexity: 8, status: 'IN_PROGRESS' });
    await createTask(other, { assignee: alice._id, complexity: 3 });
    await createTask(project, { assignee: alice._id, status: 'DONE', requiredSkills: ['Angular', 'CSS'] });
    await createTask(other, { assignee: bob._id, status: 'DONE', requiredSkills: [] });
    fetchMock.mockResolvedValue(
      jsonResponse(200, answer([item(alice._id, { score: 86 }), item(bob._id, { score: 30, matchingSkills: [], missingSkills: ['Angular'] })])),
    );

    const res = await recommend(manager);

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/ai\/developers\/recommend$/);
    const body = sent();
    expect(body.task).toEqual({ title: 'Login page', description: '', type: 'FEATURE', complexity: 5, requiredSkills: ['Angular'] });
    expect(body.options).toEqual({ workloadCapacity: 20, limit: 5 });
    expect(body.candidates).toHaveLength(2); // the deactivated member is left out
    const sentAlice = body.candidates.find((c) => c.id === alice.id);
    expect(sentAlice).toEqual({
      id: alice.id,
      name: 'Alice Test',
      skills: [{ name: 'Angular', level: 'EXPERT', yearsOfExperience: 4 }],
      openTasks: 2, // in every project, the task itself excluded
      openPoints: 11,
      completedTasks: 1,
      completedSkills: { Angular: 1, CSS: 1 },
    });
    expect(body.candidates.find((c) => c.id === bob.id)).toMatchObject({ openTasks: 0, completedTasks: 1, completedSkills: {} });

    expect(res.body.task).toEqual({ id: task.id, title: 'Login page', requiredSkills: ['Angular'] });
    expect(res.body.recommendations[0]).toEqual({
      developer: { id: alice.id, firstName: 'Alice', lastName: 'Test', email: alice.email, jobTitle: 'Frontend developer' },
      score: 86,
      matchingSkills: ['Angular'],
      missingSkills: [],
      openTasks: 2,
      openPoints: 11,
      similarCompletedTasks: 1,
      breakdown: { skills: 0.85, workload: 0.9, experience: 0.2 },
      explanation: 'Has 1 of 1 skills: Angular (advanced).',
      isAssignee: false,
    });
    expect(res.body).toMatchObject({ method: 'scoring', skillsSource: 'required', warnings: [] });
  });

  it('marks the current assignee', async () => {
    task.assignee = bob._id;
    await task.save();
    fetchMock.mockResolvedValue(jsonResponse(200, answer([item(bob._id)])));

    const res = await recommend(manager);
    expect(res.body.recommendations[0].isAssignee).toBe(true);
  });

  it('answers without calling the AI service when the team has no active developer', async () => {
    const empty = await createProject(manager);
    const lonely = await createTask(empty, { requiredSkills: [] });

    const res = await recommend(manager, lonely.id);
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ recommendations: [], skillsSource: 'none' });
    expect(res.body.warnings[0]).toMatch(/no active developer/);
  });

  it.each([
    ['an unknown developer id', () => answer([item('64b000000000000000000000')])],
    ['a score above 100', () => answer([item(alice._id, { score: 120 })])],
    ['a duplicate developer', () => answer([item(alice._id), item(alice._id)])],
    ['a wrong method', () => answer([item(alice._id)], { method: 'llm' })],
    ['a missing breakdown', () => answer([item(alice._id, { breakdown: null })])],
  ])('refuses an AI answer with %s (502)', async (_, build) => {
    fetchMock.mockResolvedValue(jsonResponse(200, build()));
    const res = await recommend(manager);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_ERROR');
  });

  it('reports the AI service as unavailable (503)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await recommend(manager);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('is reserved to the manager of a project that is not archived', async () => {
    const admin = await createAdmin();
    const outsider = await createDeveloper();
    expect((await recommend(alice)).status).toBe(403);
    expect((await recommend(admin)).status).toBe(403);
    expect((await recommend(outsider)).status).toBe(404);
    expect((await recommend(manager, 'not-an-id')).status).toBe(400);
    project.status = PROJECT_STATUSES.ARCHIVED;
    await project.save();
    expect((await recommend(manager)).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
