const request = require('supertest');
const { createApp } = require('../src/app');
const { Sprint } = require('../src/models/sprint.model');
const { Task } = require('../src/models/task.model');
const { Activity } = require('../src/models/activity.model');
const { PROJECT_STATUSES } = require('../src/models/project.model');
const { defaultStartDate } = require('../src/services/aiPlan.service');
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

const SPEC = '- Le système doit permettre de créer un compte\n- Export PDF des rapports';

const aiTask = (overrides = {}) => ({
  title: 'Créer un compte',
  description: '',
  type: 'FEATURE',
  priority: 'HIGH',
  complexity: 3,
  requiredSkills: ['Angular'],
  epic: 'Comptes',
  ...overrides,
});

const aiPlan = (overrides = {}) => ({
  method: 'local',
  model: 'local analyzer (rules + naive Bayes type classifier)',
  warnings: [],
  sprints: [
    {
      name: 'Sprint 1',
      objective: 'Livrer : Comptes',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
      totalPoints: 3,
      tasks: [aiTask()],
    },
  ],
  backlog: [aiTask({ title: 'Export PDF des rapports', priority: 'LOW', complexity: 5, epic: 'Rapports' })],
  stats: { taskCount: 2, sprintCount: 1, totalPoints: 3, epics: ['Comptes', 'Rapports'] },
  ...overrides,
});

const skill = (name) => ({ name, level: 'ADVANCED' });

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock;
let manager;
let dev;
let project;

const as = (user, req) => req.set('Authorization', bearer(user));
const generate = (user, projectId, body) =>
  as(user, request(app).post(`/api/v1/projects/${projectId}/ai/plan`).send(body));
const apply = (user, projectId, body) =>
  as(user, request(app).post(`/api/v1/projects/${projectId}/ai/plan/apply`).send(body));
const sentJson = (call) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeAll(startTestDatabase);
beforeEach(async () => {
  fetchMock = jest.spyOn(global, 'fetch');
  manager = await createManager();
  dev = await createDeveloper({ skills: [skill('Angular'), skill('Docker')] });
  const other = await createDeveloper({ skills: [skill('angular'), skill('Python')] });
  project = await createProject(manager, {
    name: 'Bibliothèque',
    description: 'Gestion des prêts',
    technologies: ['Angular', 'Node.js'],
    deadline: new Date('2026-12-31'),
    members: [dev._id, other._id],
  });
});
afterEach(async () => {
  fetchMock.mockRestore();
  jest.restoreAllMocks();
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

describe('POST /api/v1/projects/:id/ai/plan', () => {
  it('sends the specification and the project context to the AI service and returns the plan', async () => {
    await createSprint(project, { name: 'Sprint 1', startDate: new Date('2026-01-05'), endDate: new Date('2026-01-18') });
    fetchMock.mockResolvedValue(jsonResponse(200, aiPlan()));

    const res = await generate(manager, project.id, {
      text: SPEC,
      startDate: '2026-10-05',
      sprintLengthDays: 14,
      capacityPerSprint: 15,
    });

    expect(res.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://ai.test/api/v1/ai/projects/plan');
    expect(options.method).toBe('POST');
    expect(sentJson(0)).toEqual({
      text: SPEC,
      project: {
        name: 'Bibliothèque',
        description: 'Gestion des prêts',
        technologies: ['Angular', 'Node.js'],
        deadline: '2026-12-31',
      },
      options: { startDate: '2026-10-05', sprintLengthDays: 14, capacityPerSprint: 15 },
      teamSkills: ['Angular', 'Docker', 'Python'],
    });
    const { plan } = res.body;
    expect(plan.method).toBe('local');
    expect(plan.sprints[0].name).toBe('Sprint 2'); // continues the existing numbering
    expect(plan.sprints[0].tasks[0]).toEqual(aiTask());
    expect(plan.backlog).toHaveLength(1);
    expect(plan.stats).toEqual({ taskCount: 2, sprintCount: 1, totalPoints: 3, epics: ['Comptes', 'Rapports'] });
    expect(plan.options).toEqual({ startDate: '2026-10-05', sprintLengthDays: 14, capacityPerSprint: 15 });
    expect(plan.source).toEqual({ filename: null, characters: SPEC.length });
    // Nothing is stored before the manager applies the plan.
    expect(await Task.countDocuments()).toBe(0);
  });

  it('extracts an uploaded file, adds the pasted text and uses default options', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { filename: 'x', text: 'Texte du fichier', characters: 16, truncated: true }))
      .mockResolvedValueOnce(jsonResponse(200, aiPlan({ warnings: ['From the AI'] })));

    const res = await as(
      manager,
      request(app)
        .post(`/api/v1/projects/${project.id}/ai/plan`)
        .field('text', SPEC)
        .attach('file', Buffer.from('# Cahier\n- Créer un compte'), 'cahier-des-charges-é.md'),
    );

    expect(res.status).toBe(200);
    const [extractUrl, extractOptions] = fetchMock.mock.calls[0];
    expect(String(extractUrl)).toBe('http://ai.test/api/v1/ai/documents/extract');
    expect(extractOptions.body).toBeInstanceOf(FormData);
    const file = extractOptions.body.get('file');
    expect(file.name).toBe('cahier-des-charges-é.md');
    expect(await file.text()).toBe('# Cahier\n- Créer un compte');

    const sent = sentJson(1);
    expect(sent.text).toBe(`${SPEC}\n\nTexte du fichier`);
    expect(sent.options.sprintLengthDays).toBe(14);
    expect(sent.options.capacityPerSprint).toBe(20);
    expect(res.body.plan.warnings).toEqual([
      'The file «cahier-des-charges-é.md» is long: only its first 16 characters were analysed.',
      'From the AI',
    ]);
    expect(res.body.plan.source.filename).toBe('cahier-des-charges-é.md');
    expect(res.body.plan.sprints[0].name).toBe('Sprint 1');
  });

  it('refuses a missing or too short specification, invalid options and unsupported files', async () => {
    let res = await generate(manager, project.id, { text: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('text');

    res = await generate(manager, project.id, { text: SPEC, sprintLengthDays: 2, capacityPerSprint: 'many' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(['sprintLengthDays', 'capacityPerSprint']);

    res = await as(
      manager,
      request(app).post(`/api/v1/projects/${project.id}/ai/plan`).attach('file', Buffer.from('MZ'), 'virus.exe'),
    );
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    res = await as(
      manager,
      request(app)
        .post(`/api/v1/projects/${project.id}/ai/plan`)
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 'a'), 'big.txt'),
    );
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is reserved to the manager of an active project', async () => {
    const outsider = await createManager();
    const admin = await createAdmin();
    expect((await generate(dev, project.id, { text: SPEC })).status).toBe(403);
    expect((await generate(admin, project.id, { text: SPEC })).status).toBe(403);
    expect((await generate(outsider, project.id, { text: SPEC })).status).toBe(404);
    expect((await generate(manager, 'not-an-id', { text: SPEC })).status).toBe(400);

    project.status = PROJECT_STATUSES.ARCHIVED;
    await project.save();
    expect((await generate(manager, project.id, { text: SPEC })).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown method', aiPlan({ method: 'magic' })],
    ['a complexity outside the scale', aiPlan({ backlog: [aiTask({ complexity: 4 })] })],
    ['an unknown task type', aiPlan({ backlog: [aiTask({ type: 'EPIC' })] })],
    ['a title too long', aiPlan({ backlog: [aiTask({ title: 'x'.repeat(201) })] })],
    ['dates in the wrong order', aiPlan({ sprints: [{ ...aiPlan().sprints[0], endDate: '2026-10-01' }] })],
    ['too many tasks', aiPlan({ backlog: Array.from({ length: 101 }, (_, index) => aiTask({ title: `T${index}` })) })],
    ['no sprints array', { method: 'local', model: 'x', warnings: [], backlog: [] }],
  ])('answers 502 when the AI service returns %s', async (_, answer) => {
    fetchMock.mockResolvedValue(jsonResponse(200, answer));
    const res = await generate(manager, project.id, { text: SPEC });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: 'AI_ERROR', message: 'The AI service returned an invalid plan' });
  });

  it('removes duplicate skills of the AI answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, aiPlan({ backlog: [aiTask({ requiredSkills: ['Angular', 'angular '] })] })));
    const res = await generate(manager, project.id, { text: SPEC });
    expect(res.body.plan.backlog[0].requiredSkills).toEqual(['Angular']);
  });

  it('forwards the reason when the AI service refuses the content, and 503 when it is down', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { status: 422, code: 'UNPROCESSABLE_ENTITY', message: 'No requirement could be identified' } }),
    );
    let res = await generate(manager, project.id, { text: SPEC });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('No requirement could be identified');

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    res = await generate(manager, project.id, { text: SPEC });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });
});

describe('default start date of the plan', () => {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const inDays = (days) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  it('is today, the project start when later, or the day after the last sprint', () => {
    expect(defaultStartDate({ startDate: inDays(-30) }, null)).toEqual(today);
    expect(defaultStartDate({ startDate: inDays(10) }, null)).toEqual(inDays(10));
    expect(defaultStartDate({ startDate: inDays(-30) }, { endDate: inDays(5) })).toEqual(inDays(6));
    expect(defaultStartDate({ startDate: inDays(-30) }, { endDate: inDays(-5) })).toEqual(today);
  });
});

describe('POST /api/v1/projects/:id/ai/plan/apply', () => {
  const reviewed = () => ({
    method: 'llm',
    sprints: [
      {
        name: 'Sprint 1',
        objective: 'Livrer : Comptes',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
        tasks: [
          { ...aiTask(), status: 'DONE', assignee: String(dev._id) }, // unknown fields are ignored
          aiTask({ title: 'Se connecter', requiredSkills: [] }),
        ],
      },
      { name: 'Sprint 2', objective: '', startDate: '2026-10-19', endDate: '2026-11-01', tasks: [] },
    ],
    backlog: [aiTask({ title: 'Export PDF', priority: 'LOW', complexity: 8 })],
  });

  it('creates PLANNED sprints and TODO tasks, and records one activity', async () => {
    const res = await apply(manager, project.id, reviewed());

    expect(res.status).toBe(201);
    expect(res.body.tasksCreated).toBe(3);
    expect(res.body.backlogTasks).toBe(1);
    expect(res.body.sprints.map((sprint) => [sprint.name, sprint.status])).toEqual([
      ['Sprint 1', 'PLANNED'],
      ['Sprint 2', 'PLANNED'],
    ]);

    const sprint = await Sprint.findOne({ name: 'Sprint 1' });
    expect(sprint.startDate.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    const tasks = await Task.find().sort({ title: 1 });
    expect(tasks.map((task) => [task.title, task.status, task.assignee, String(task.sprint)])).toEqual([
      ['Créer un compte', 'TODO', null, sprint.id],
      ['Export PDF', 'TODO', null, 'null'],
      ['Se connecter', 'TODO', null, sprint.id],
    ]);
    expect(tasks[0]).toMatchObject({ type: 'FEATURE', priority: 'HIGH', complexity: 3, createdBy: manager._id });
    expect(tasks[0].requiredSkills).toEqual(['Angular']);

    const activities = await Activity.find({ project: project._id });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ type: 'AI_PLAN_APPLIED', details: { sprints: 2, tasks: 3, method: 'llm' } });
  });

  it('validates every sprint and task of the reviewed plan', async () => {
    const plan = reviewed();
    plan.sprints[0].tasks[1].complexity = 4;
    plan.sprints[1].name = '';
    plan.backlog[0].requiredSkills = ['Angular', 'angular'];
    const res = await apply(manager, project.id, plan);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail) => detail.field)).toEqual([
      'sprints[1].name',
      'sprints[0].tasks[1].complexity',
      'backlog[0].requiredSkills',
    ]);
  });

  it('refuses an empty plan, too many tasks or sprints, and dates in the wrong order', async () => {
    let res = await apply(manager, project.id, { sprints: [], backlog: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toBe('The plan contains no task');

    res = await apply(manager, project.id, {
      sprints: [],
      backlog: Array.from({ length: 101 }, (_, index) => aiTask({ title: `T${index}` })),
    });
    expect(res.status).toBe(400);

    const sprint = reviewed().sprints[1];
    res = await apply(manager, project.id, { sprints: Array.from({ length: 21 }, () => sprint), backlog: [aiTask()] });
    expect(res.status).toBe(400);

    res = await apply(manager, project.id, { sprints: [{ ...sprint, endDate: '2026-10-01' }], backlog: [aiTask()] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('sprints[0].endDate');
    expect(await Sprint.countDocuments()).toBe(0);
  });

  it('creates nothing when the creation fails midway', async () => {
    jest.spyOn(Task, 'insertMany').mockRejectedValueOnce(new Error('database down'));
    const res = await apply(manager, project.id, reviewed());
    expect(res.status).toBe(500);
    expect(await Sprint.countDocuments()).toBe(0);
    expect(await Task.countDocuments()).toBe(0);
  });

  it('is reserved to the manager of the project', async () => {
    expect((await apply(dev, project.id, reviewed())).status).toBe(403);
    expect(await Task.countDocuments()).toBe(0);
  });
});
