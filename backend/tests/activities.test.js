const request = require('supertest');
const { createApp } = require('../src/app');
const { Activity } = require('../src/models/activity.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createManager, createDeveloper, createProject, bearer } = require('./helpers/factories');

const app = createApp();

let manager;
let dev;
let outsider;

const as = (user, req) => req.set('Authorization', bearer(user));
const post = (user, url, body) => as(user, request(app).post(`/api/v1${url}`).send(body));
const patch = (user, url, body) => as(user, request(app).patch(`/api/v1${url}`).send(body));
const get = (user, url) => as(user, request(app).get(`/api/v1${url}`));

beforeAll(startTestDatabase);
beforeEach(async () => {
  manager = await createManager();
  dev = await createDeveloper({ firstName: 'Youssef', lastName: 'Alami' });
  outsider = await createDeveloper();
});
afterEach(() => {
  jest.restoreAllMocks();
  return clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('Activity history', () => {
  it('records the main project, sprint, task and comment events', async () => {
    const projectId = (await post(manager, '/projects', { name: 'Shop', startDate: '2026-10-01' })).body.project.id;
    await post(manager, `/projects/${projectId}/members`, { userId: dev.id });
    const sprintId = (
      await post(manager, `/projects/${projectId}/sprints`, { name: 'S1', startDate: '2026-10-05', endDate: '2026-10-18' })
    ).body.sprint.id;
    const taskId = (
      await post(manager, `/projects/${projectId}/tasks`, { title: 'Login', assignee: dev.id, sprint: sprintId })
    ).body.task.id;
    await patch(manager, `/tasks/${taskId}`, { title: 'Login page', priority: 'MEDIUM' }); // priority unchanged
    await patch(dev, `/tasks/${taskId}/status`, { status: 'IN_PROGRESS' });
    await post(dev, `/tasks/${taskId}/comments`, { content: 'Started' });
    await patch(manager, `/projects/${projectId}`, { status: 'ACTIVE' });

    const res = await get(dev, `/projects/${projectId}/activities`);

    expect(res.status).toBe(200);
    const events = res.body.data.map((a) => [a.type, a.details]);
    expect(events).toEqual([
      ['PROJECT_STATUS_CHANGED', { from: 'PLANNING', to: 'ACTIVE' }],
      ['COMMENT_ADDED', expect.objectContaining({ title: 'Login page' })],
      ['TASK_STATUS_CHANGED', { title: 'Login page', from: 'TODO', to: 'IN_PROGRESS' }],
      ['TASK_UPDATED', { title: 'Login page', fields: ['title'] }],
      ['TASK_ASSIGNED', { title: 'Login' }],
      ['TASK_CREATED', { title: 'Login' }],
      ['SPRINT_CREATED', { name: 'S1' }],
      ['MEMBER_ADDED', { name: 'Youssef Alami' }],
      ['PROJECT_CREATED', { name: 'Shop' }],
    ]);

    const assigned = res.body.data.find((a) => a.type === 'TASK_ASSIGNED');
    expect(assigned.actor).toMatchObject({ id: manager.id, firstName: manager.firstName });
    expect(assigned.targetUser).toMatchObject({ id: dev.id, firstName: 'Youssef' });
    expect(assigned.task).toBe(taskId);
  });

  it('filters project history by type and returns a task history', async () => {
    const project = await createProject(manager, { members: [dev._id] });
    const t1 = (await post(manager, `/projects/${project.id}/tasks`, { title: 'A', assignee: dev.id })).body.task.id;
    await post(manager, `/projects/${project.id}/tasks`, { title: 'B' });
    await patch(dev, `/tasks/${t1}/status`, { status: 'IN_PROGRESS' });

    const created = await get(manager, `/projects/${project.id}/activities?type=TASK_CREATED`);
    expect(created.body.data.map((a) => a.details.title)).toEqual(['B', 'A']);

    const history = await get(dev, `/tasks/${t1}/activities`);
    expect(history.body.data.map((a) => a.type)).toEqual(['TASK_STATUS_CHANGED', 'TASK_ASSIGNED', 'TASK_CREATED']);
  });

  it('records unassignment, sprint changes and deletions with a readable snapshot', async () => {
    const project = await createProject(manager, { members: [dev._id] });
    const taskId = (await post(manager, `/projects/${project.id}/tasks`, { title: 'Temp', assignee: dev.id })).body.task.id;
    await patch(manager, `/tasks/${taskId}/assignee`, { assigneeId: null });
    const sprintId = (
      await post(manager, `/projects/${project.id}/sprints`, { name: 'S9', startDate: '2026-10-05', endDate: '2026-10-18' })
    ).body.sprint.id;
    await patch(manager, `/sprints/${sprintId}/status`, { status: 'ACTIVE' });
    await as(manager, request(app).delete(`/api/v1/tasks/${taskId}`));

    const types = (await get(manager, `/projects/${project.id}/activities`)).body.data.map((a) => [a.type, a.details]);

    expect(types.slice(0, 4)).toEqual([
      ['TASK_DELETED', { title: 'Temp' }],
      ['SPRINT_STATUS_CHANGED', { name: 'S9', from: 'PLANNED', to: 'ACTIVE' }],
      ['SPRINT_CREATED', { name: 'S9' }],
      ['TASK_UNASSIGNED', { title: 'Temp' }],
    ]);
  });

  it('is visible to project viewers only and validates the type filter', async () => {
    const project = await createProject(manager);

    expect((await get(outsider, `/projects/${project.id}/activities`)).status).toBe(404);
    expect((await get(manager, `/projects/${project.id}/activities?type=NOPE`)).status).toBe(400);
  });

  it('never makes the main operation fail when the history cannot be written', async () => {
    jest.spyOn(Activity, 'create').mockRejectedValueOnce(new Error('disk full'));

    const res = await post(manager, '/projects', { name: 'Resilient', startDate: '2026-10-01' });

    expect(res.status).toBe(201);
    expect(await Activity.countDocuments()).toBe(0);
  });
});
