const request = require('supertest');
const { createApp } = require('../src/app');
const { Comment } = require('../src/models/comment.model');
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

let admin;
let manager;
let dev;
let dev2;
let outsider;
let project;
let task;

const as = (user, req) => req.set('Authorization', bearer(user));
const api = {
  list: (user, query = '') => as(user, request(app).get(`/api/v1/tasks/${task.id}/comments${query}`)),
  add: (user, content, taskId = task.id) =>
    as(user, request(app).post(`/api/v1/tasks/${taskId}/comments`).send({ content })),
  edit: (user, id, content) => as(user, request(app).patch(`/api/v1/comments/${id}`).send({ content })),
  remove: (user, id) => as(user, request(app).delete(`/api/v1/comments/${id}`)),
};

beforeAll(startTestDatabase);
beforeEach(async () => {
  admin = await createAdmin();
  manager = await createManager();
  dev = await createDeveloper();
  dev2 = await createDeveloper();
  outsider = await createDeveloper();
  project = await createProject(manager, { members: [dev._id, dev2._id] });
  task = await createTask(project, { assignee: dev._id });
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/tasks/:id/comments', () => {
  it('lets members and the manager comment (trimmed content, populated author)', async () => {
    const res = await api.add(dev, '  Login form done, waiting for review  ');

    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({
      task: task.id,
      project: project.id,
      content: 'Login form done, waiting for review',
      author: { id: dev.id, firstName: dev.firstName },
    });
    expect((await api.add(manager, 'Thanks')).status).toBe(201);
  });

  it('refuses admins (403) and outsiders (404)', async () => {
    expect((await api.add(admin, 'Hello')).status).toBe(403);
    expect((await api.add(outsider, 'Hello')).status).toBe(404);
  });

  it.each([
    ['', 'Content is required'],
    ['x'.repeat(2001), 'Content must be at most 2000 characters'],
  ])('returns 400 for invalid content (%#)', async (content, message) => {
    const res = await api.add(dev, content);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'content', message }]);
  });

  it('refuses comments on an archived project', async () => {
    project.status = 'ARCHIVED';
    await project.save();

    expect((await api.add(dev, 'Hello')).status).toBe(409);
  });
});

describe('GET /api/v1/tasks/:id/comments', () => {
  it('lists comments oldest first, with pagination, to every viewer', async () => {
    await api.add(dev, 'First');
    await api.add(manager, 'Second');
    await api.add(dev2, 'Third');

    const res = await api.list(admin, '?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.content)).toEqual(['First', 'Second']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect((await api.list(outsider)).status).toBe(404);
  });
});

describe('PATCH / DELETE /api/v1/comments/:id', () => {
  let comment;

  beforeEach(async () => {
    comment = (await api.add(dev, 'Original')).body.comment;
  });

  it('lets the author edit their comment and records editedAt', async () => {
    const res = await api.edit(dev, comment.id, 'Edited');

    expect(res.status).toBe(200);
    expect(res.body.comment.content).toBe('Edited');
    expect(Date.parse(res.body.comment.editedAt)).not.toBeNaN();
  });

  it('refuses edits by anyone else, including the manager', async () => {
    expect((await api.edit(manager, comment.id, 'Hacked')).status).toBe(403);
    expect((await api.edit(dev2, comment.id, 'Hacked')).status).toBe(403);
    expect((await api.edit(outsider, comment.id, 'Hacked')).status).toBe(404);
  });

  it('lets the author delete their comment', async () => {
    expect((await api.remove(dev, comment.id)).status).toBe(204);
    expect(await Comment.findById(comment.id)).toBeNull();
  });

  it('lets the project manager delete any comment (moderation), not other members', async () => {
    expect((await api.remove(dev2, comment.id)).status).toBe(403);
    expect((await api.remove(manager, comment.id)).status).toBe(204);
  });

  it('returns 404 for an unknown comment and 400 for an invalid id', async () => {
    expect((await api.edit(dev, '507f1f77bcf86cd799439011', 'x')).status).toBe(404);
    expect((await api.remove(dev, 'abc')).body.error.details).toEqual([{ field: 'id', message: 'Invalid comment id' }]);
  });

  it('deletes the comments of a deleted task', async () => {
    await as(manager, request(app).delete(`/api/v1/tasks/${task.id}`));

    expect(await Comment.countDocuments({ task: task._id })).toBe(0);
  });
});
