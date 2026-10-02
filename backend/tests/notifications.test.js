const request = require('supertest');
const { createApp } = require('../src/app');
const { Notification, NOTIFICATION_TTL_SECONDS } = require('../src/models/notification.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');
const { createManager, createDeveloper, createProject, bearer } = require('./helpers/factories');

const app = createApp();

let manager;
let dev;
let dev2;
let project;

const as = (user, req) => req.set('Authorization', bearer(user));
const post = (user, url, body) => as(user, request(app).post(`/api/v1${url}`).send(body));
const patch = (user, url, body) => as(user, request(app).patch(`/api/v1${url}`).send(body));
const get = (user, url) => as(user, request(app).get(`/api/v1${url}`));
const inbox = async (user) => (await get(user, '/notifications')).body.data.map((n) => [n.type, n.message]);

beforeAll(startTestDatabase);
beforeEach(async () => {
  manager = await createManager({ firstName: 'Sara', lastName: 'Manager' });
  dev = await createDeveloper({ firstName: 'Youssef', lastName: 'Alami' });
  dev2 = await createDeveloper({ firstName: 'Amira', lastName: 'Ben' });
  project = await createProject(manager, { name: 'Shop' });
});
afterEach(() => {
  jest.restoreAllMocks();
  return clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('Notifications generated from project activity', () => {
  it('notifies the right people, never the author of the action', async () => {
    await post(manager, `/projects/${project.id}/members`, { userId: dev.id });
    await post(manager, `/projects/${project.id}/members`, { userId: dev2.id });
    const taskId = (await post(manager, `/projects/${project.id}/tasks`, { title: 'Login', assignee: dev.id })).body.task.id;
    await patch(dev, `/tasks/${taskId}/status`, { status: 'IN_PROGRESS' });
    await post(manager, `/tasks/${taskId}/comments`, { content: 'Great' });

    expect(await inbox(dev)).toEqual([
      ['COMMENT_ADDED', 'Sara Manager commented on «Login»'],
      ['TASK_ASSIGNED', 'Sara Manager assigned you the task «Login»'],
      ['ADDED_TO_PROJECT', 'Sara Manager added you to the project «Shop»'],
    ]);
    expect(await inbox(manager)).toEqual([
      ['TASK_STATUS_CHANGED', 'Youssef Alami moved «Login» from TODO to IN_PROGRESS'],
    ]);
    expect(await inbox(dev2)).toEqual([['ADDED_TO_PROJECT', 'Sara Manager added you to the project «Shop»']]);
  });

  it('notifies the team when a sprint starts, and a developer when unassigned or removed', async () => {
    project.members.push(dev._id, dev2._id);
    await project.save();
    const sprintId = (
      await post(manager, `/projects/${project.id}/sprints`, { name: 'S1', startDate: '2026-10-05', endDate: '2026-10-18' })
    ).body.sprint.id;
    await patch(manager, `/sprints/${sprintId}/status`, { status: 'ACTIVE' });
    const taskId = (await post(manager, `/projects/${project.id}/tasks`, { title: 'Cart', assignee: dev2.id })).body.task.id;
    await patch(manager, `/tasks/${taskId}/assignee`, { assigneeId: null });
    await as(manager, request(app).delete(`/api/v1/projects/${project.id}/members/${dev2.id}`));

    expect(await inbox(dev2)).toEqual([
      ['REMOVED_FROM_PROJECT', 'Sara Manager removed you from the project «Shop»'],
      ['TASK_UNASSIGNED', 'Sara Manager unassigned you from the task «Cart»'],
      ['TASK_ASSIGNED', 'Sara Manager assigned you the task «Cart»'],
      ['SPRINT_STARTED', 'The sprint «S1» has started in «Shop»'],
    ]);
    expect(await inbox(manager)).toEqual([]);
  });

  it('never makes the main operation fail when notifications cannot be stored', async () => {
    jest.spyOn(Notification, 'insertMany').mockRejectedValueOnce(new Error('db down'));

    const res = await post(manager, `/projects/${project.id}/members`, { userId: dev.id });

    expect(res.status).toBe(201);
    expect(await Notification.countDocuments()).toBe(0);
  });
});

describe('Notification endpoints', () => {
  let notificationIds;

  beforeEach(async () => {
    await post(manager, `/projects/${project.id}/members`, { userId: dev.id });
    await post(manager, `/projects/${project.id}/tasks`, { title: 'A', assignee: dev.id });
    await post(manager, `/projects/${project.id}/tasks`, { title: 'B', assignee: dev.id });
    notificationIds = (await get(dev, '/notifications')).body.data.map((n) => n.id);
  });

  it('lists my notifications newest first with the unread counter and the actor', async () => {
    const res = await get(dev, '/notifications?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(3);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data[0]).toMatchObject({
      type: 'TASK_ASSIGNED',
      read: false,
      project: project.id,
      actor: { id: manager.id, firstName: 'Sara' },
    });
  });

  it('marks one notification as read, then filters unread ones', async () => {
    const res = await patch(dev, `/notifications/${notificationIds[0]}/read`);

    expect(res.status).toBe(200);
    expect(res.body.notification).toMatchObject({ id: notificationIds[0], read: true });
    expect(Date.parse(res.body.notification.readAt)).not.toBeNaN();
    expect((await get(dev, '/notifications/unread-count')).body).toEqual({ unreadCount: 2 });
    expect((await get(dev, '/notifications?unread=true')).body.data.map((n) => n.id)).toEqual(notificationIds.slice(1));
  });

  it('marks all as read', async () => {
    const res = await patch(dev, '/notifications/read-all');

    expect(res.body).toEqual({ updated: 3 });
    expect((await get(dev, '/notifications/unread-count')).body.unreadCount).toBe(0);
  });

  it('deletes a notification', async () => {
    expect((await as(dev, request(app).delete(`/api/v1/notifications/${notificationIds[0]}`))).status).toBe(204);
    expect((await get(dev, '/notifications')).body.pagination.total).toBe(2);
  });

  it("does not expose other users' notifications (404)", async () => {
    expect((await patch(dev2, `/notifications/${notificationIds[0]}/read`)).status).toBe(404);
    expect((await as(dev2, request(app).delete(`/api/v1/notifications/${notificationIds[0]}`))).status).toBe(404);
    expect((await get(dev2, '/notifications')).body.data).toEqual([]);
  });

  it('validates input and requires authentication', async () => {
    expect((await get(dev, '/notifications?unread=yes')).status).toBe(400);
    expect((await patch(dev, '/notifications/abc/read')).status).toBe(400);
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });
});

describe('Notification model', () => {
  it('expires notifications automatically after 90 days (TTL index)', async () => {
    await Notification.init();
    const indexes = await Notification.collection.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: { createdAt: 1 }, expireAfterSeconds: NOTIFICATION_TTL_SECONDS })]),
    );
  });
});
