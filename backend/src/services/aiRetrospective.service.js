/**
 * AI-05 — retrospective of a completed sprint.
 *
 * The backend gathers the facts of the sprint (tasks and their outcome, blocks found in the history, tasks added
 * after the start, late tasks, workload per member, velocity of the previous sprints); the AI service computes the
 * metrics and writes the retrospective (LLM, or rules without a key). The answer is validated, then saved: one
 * retrospective per sprint, replaced when it is regenerated. Each proposed action can become a task, once.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { SPRINT_STATUSES } = require('../models/sprint.model');
const { Task, TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } = require('../models/task.model');
const { User } = require('../models/user.model');
const { Activity, ACTIVITY_TYPES } = require('../models/activity.model');
const { SprintRetrospective, RETROSPECTIVE_LIMITS: LIMITS } = require('../models/sprintRetrospective.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const aiClient = require('./aiClient.service');
const sprintService = require('./sprint.service');
const taskService = require('./task.service');
const { historicalVelocity } = require('./aiRisk.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TASKS = 300;
const METRICS = [
  'totalTasks',
  'doneTasks',
  'totalPoints',
  'donePoints',
  'completionRate',
  'durationDays',
  'velocity',
  'blockedTasks',
  'blockedDuringSprint',
  'addedAfterStart',
  'lateTasks',
  'unassignedOpen',
];

const isoDate = (date) => date.toISOString().slice(0, 10);
const fullName = (user) => `${user.firstName} ${user.lastName}`;

// ---------- facts of the sprint ----------
async function sprintFacts(sprint, project) {
  const tasks = await Task.find({ sprint: sprint._id })
    .populate('assignee', 'firstName lastName')
    .select('title type priority complexity status assignee blockedReason deadline completedAt createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .limit(MAX_TASKS)
    .lean();
  const [blockedIds, members, velocity] = await Promise.all([
    Activity.distinct('task', {
      type: ACTIVITY_TYPES.TASK_STATUS_CHANGED,
      task: { $in: tasks.map((task) => task._id) },
      'details.to': TASK_STATUSES.BLOCKED,
    }),
    User.find({ _id: { $in: project.members }, isActive: true }).select('firstName lastName').lean(),
    historicalVelocity(project._id, { exclude: sprint._id }),
  ]);
  const wasBlocked = new Set(blockedIds.map(String));
  // Created after the first day of the sprint = added to the sprint once it had started.
  const planningEnd = sprint.startDate.getTime() + DAY_MS;
  const closedAt = (sprint.completedAt ?? new Date()).getTime();

  const points = new Map(members.map((member) => [String(member._id), { done: 0, open: 0 }]));
  const facts = tasks.map((task) => {
    const done = task.status === TASK_STATUSES.DONE;
    const deadlineEnd = task.deadline ? task.deadline.getTime() + DAY_MS : null;
    const late =
      deadlineEnd !== null && (done ? task.completedAt && task.completedAt.getTime() > deadlineEnd : closedAt > deadlineEnd);
    if (task.assignee && points.has(String(task.assignee._id))) {
      points.get(String(task.assignee._id))[done ? 'done' : 'open'] += task.complexity;
    }
    return {
      title: task.title,
      type: task.type,
      priority: task.priority,
      points: task.complexity,
      status: task.status,
      assignee: task.assignee ? fullName(task.assignee) : null,
      blockedReason: task.status === TASK_STATUSES.BLOCKED ? task.blockedReason || null : null,
      wasBlocked: wasBlocked.has(String(task._id)),
      addedAfterStart: task.createdAt.getTime() >= planningEnd,
      late: Boolean(late),
    };
  });
  return {
    sprint: {
      name: sprint.name,
      objective: sprint.objective ?? '',
      startDate: isoDate(sprint.startDate),
      endDate: isoDate(sprint.endDate),
    },
    tasks: facts,
    team: members.map((member) => {
      const load = points.get(String(member._id));
      return { name: fullName(member), donePoints: load.done, openPoints: load.open };
    }),
    historicalVelocity: velocity,
  };
}

// ---------- validation of the AI answer ----------
const isText = (value, max) => typeof value === 'string' && value.length <= max;
const isTextList = (value, max) => Array.isArray(value) && value.length <= max && value.every((item) => isText(item, LIMITS.itemMaxLength));
const isCount = (value) => Number.isInteger(value) && value >= 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function parseAnswer(payload) {
  const metrics = payload?.metrics;
  const valid =
    ['llm', 'local'].includes(payload?.method) &&
    (payload.model === null || isText(payload.model, 200)) &&
    isText(payload.summary, LIMITS.summaryMaxLength) &&
    payload.summary.trim().length > 0 &&
    isTextList(payload.delivered, LIMITS.maxItems) &&
    isTextList(payload.slipped, LIMITS.maxItems) &&
    isTextList(payload.blockers, LIMITS.maxItems) &&
    isTextList(payload.wentWell, LIMITS.maxOpinions) &&
    isTextList(payload.toImprove, LIMITS.maxOpinions) &&
    Array.isArray(payload.actions) &&
    payload.actions.length <= LIMITS.maxActions &&
    payload.actions.every(
      (action) =>
        isText(action?.title, LIMITS.actionTitleMaxLength) &&
        action.title.trim().length > 0 &&
        isText(action.description, LIMITS.actionDescriptionMaxLength) &&
        Object.values(TASK_TYPES).includes(action.type) &&
        Object.values(TASK_PRIORITIES).includes(action.priority),
    ) &&
    metrics !== null &&
    typeof metrics === 'object' &&
    METRICS.every((name) => (name === 'completionRate' || name === 'velocity' ? isNumber(metrics[name]) : isCount(metrics[name]))) &&
    metrics.completionRate >= 0 &&
    metrics.completionRate <= 1 &&
    [metrics.historicalVelocity, metrics.velocityChange].every((value) => value === null || isNumber(value)) &&
    Array.isArray(payload.warnings) &&
    payload.warnings.every((warning) => isText(warning, 500));
  if (!valid) {
    logger.error('Invalid retrospective answer from the AI service');
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid retrospective');
  }
  return payload;
}

// ---------- API ----------
async function view(retrospective) {
  await retrospective.populate([
    { path: 'generatedBy', select: 'firstName lastName' },
    { path: 'sprint', select: 'name status startDate endDate' },
  ]);
  return retrospective.toJSON();
}

/** The saved retrospective of a sprint (project viewers), or null. */
async function getRetrospective(actor, sprintId) {
  const { sprint } = await sprintService.findViewableSprint(sprintId, actor);
  const retrospective = await SprintRetrospective.findOne({ sprint: sprint._id });
  return { retrospective: retrospective ? await view(retrospective) : null };
}

/** Generates (or regenerates) the retrospective of a COMPLETED sprint (manager of the project). */
async function generateRetrospective(actor, sprintId) {
  const { sprint, project } = await sprintService.findManagedSprint(sprintId, actor);
  if (sprint.status !== SPRINT_STATUSES.COMPLETED) {
    throw ApiError.conflict(`A retrospective is written for a completed sprint (this one is ${sprint.status})`);
  }
  const answer = parseAnswer(
    await aiClient.request('/api/v1/ai/sprints/retrospective', { method: 'POST', json: await sprintFacts(sprint, project) }),
  );
  const fields = {
    project: project._id,
    method: answer.method,
    model: answer.model,
    summary: answer.summary,
    delivered: answer.delivered,
    slipped: answer.slipped,
    blockers: answer.blockers,
    wentWell: answer.wentWell,
    toImprove: answer.toImprove,
    actions: answer.actions.map(({ title, description, type, priority }) => ({
      id: crypto.randomUUID(),
      title: title.trim(),
      description,
      type,
      priority,
      task: null,
    })),
    metrics: Object.fromEntries([...METRICS, 'historicalVelocity', 'velocityChange'].map((name) => [name, answer.metrics[name]])),
    warnings: answer.warnings,
    generatedBy: actor._id,
  };
  const retrospective = await SprintRetrospective.findOneAndUpdate(
    { sprint: sprint._id },
    { $set: fields },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
  return { retrospective: await view(retrospective) };
}

/**
 * Creates a task from an action of the retrospective (once), in an open sprint of the project or in the
 * backlog (sprint: null). Same checks, history and notifications as the task API.
 */
async function createTaskFromAction(actor, sprintId, actionId, { sprint: targetSprint = null }) {
  const { sprint, project } = await sprintService.findManagedSprint(sprintId, actor);
  const retrospective = await SprintRetrospective.findOne({ sprint: sprint._id });
  const action = retrospective?.actions.find((item) => item.id === actionId);
  if (!action) throw ApiError.notFound('Action not found in the retrospective of this sprint');

  // The action is reserved first (conditional update): two quick clicks cannot create two tasks.
  const reservation = new mongoose.Types.ObjectId();
  const reserved = await SprintRetrospective.updateOne(
    { _id: retrospective._id, actions: { $elemMatch: { id: actionId, task: null } } },
    { $set: { 'actions.$.task': reservation } },
  );
  if (reserved.modifiedCount === 0) throw ApiError.conflict('A task has already been created from this action');

  let task;
  try {
    task = await taskService.createTask(actor, project.id, {
      title: action.title,
      description: [action.description, `From the retrospective of «${sprint.name}».`].filter(Boolean).join('\n\n'),
      type: action.type,
      priority: action.priority,
      sprint: targetSprint,
    });
  } catch (err) {
    await SprintRetrospective.updateOne(
      { _id: retrospective._id, 'actions.task': reservation },
      { $set: { 'actions.$.task': null } },
    );
    throw err;
  }
  const updated = await SprintRetrospective.findOneAndUpdate(
    { _id: retrospective._id, 'actions.task': reservation },
    { $set: { 'actions.$.task': task._id } },
    { returnDocument: 'after' },
  );
  return { task, retrospective: await view(updated) };
}

module.exports = { getRetrospective, generateRetrospective, createTaskFromAction, sprintFacts };
