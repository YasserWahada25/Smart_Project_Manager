/**
 * AI-03 — delay risk of a planned or active sprint.
 *
 * The backend measures the sprint today (tasks, story points, blocked / complex / unassigned open tasks,
 * team size, velocity of the previous sprints), the AI service predicts the risk (logistic regression),
 * and the answer is validated before being returned. Nothing is stored: the risk changes every day.
 */
const { Sprint, SPRINT_STATUSES } = require('../models/sprint.model');
const { Task, TASK_STATUSES, HIGH_COMPLEXITY_THRESHOLD } = require('../models/task.model');
const { User } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const aiClient = require('./aiClient.service');
const sprintService = require('./sprint.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const VELOCITY_SPRINTS = 3;
const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

const isoDate = (date) => date.toISOString().slice(0, 10);

/** Story points per day delivered in the last completed sprints of the project (null if none). */
async function historicalVelocity(projectId) {
  const sprints = await Sprint.find({ project: projectId, status: SPRINT_STATUSES.COMPLETED })
    .sort({ endDate: -1 })
    .limit(VELOCITY_SPRINTS)
    .select('startDate endDate');
  if (sprints.length === 0) return null;
  const done = await Task.aggregate([
    { $match: { sprint: { $in: sprints.map((sprint) => sprint._id) }, status: TASK_STATUSES.DONE } },
    { $group: { _id: '$sprint', points: { $sum: '$complexity' } } },
  ]);
  const points = new Map(done.map((row) => [String(row._id), row.points]));
  const velocities = sprints.map((sprint) => {
    const days = Math.round((sprint.endDate - sprint.startDate) / DAY_MS) + 1;
    return (points.get(String(sprint._id)) ?? 0) / days;
  });
  return Math.round((velocities.reduce((sum, value) => sum + value, 0) / velocities.length) * 100) / 100;
}

function measureTasks(tasks) {
  const open = tasks.filter((task) => task.status !== TASK_STATUSES.DONE);
  const sum = (list) => list.reduce((points, task) => points + task.complexity, 0);
  return {
    total: tasks.length,
    done: tasks.length - open.length,
    blocked: open.filter((task) => task.status === TASK_STATUSES.BLOCKED).length,
    highComplexityOpen: open.filter((task) => task.complexity >= HIGH_COMPLEXITY_THRESHOLD).length,
    unassignedOpen: open.filter((task) => !task.assignee).length,
    totalPoints: sum(tasks),
    donePoints: sum(tasks.filter((task) => task.status === TASK_STATUSES.DONE)),
  };
}

// ---------- validation of the AI answer ----------
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isText = (value, max) => typeof value === 'string' && value.length <= max;

function parseAnswer(payload) {
  const valid =
    LEVELS.includes(payload?.riskLevel) &&
    isNumber(payload.probability) &&
    payload.probability >= 0 &&
    payload.probability <= 1 &&
    ['model', 'rule'].includes(payload.method) &&
    Array.isArray(payload.factors) &&
    payload.factors.length <= 7 &&
    payload.factors.every((factor) => isText(factor?.code, 50) && isText(factor.label, 300) && isNumber(factor.impact)) &&
    payload.features !== null &&
    typeof payload.features === 'object' &&
    Object.values(payload.features).every(isNumber) &&
    isText(payload.model?.name, 200) &&
    Array.isArray(payload.warnings) &&
    payload.warnings.every((warning) => isText(warning, 500));
  if (!valid) {
    logger.error('Invalid risk answer from the AI service');
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid risk prediction');
  }
  return payload;
}

async function predictSprintRisk(actor, sprintId) {
  const { sprint, project } = await sprintService.findViewableSprint(sprintId, actor);
  if (sprint.isClosed()) {
    throw ApiError.conflict(`The delay risk is only predicted for planned or active sprints (this one is ${sprint.status})`);
  }
  const [tasks, teamSize, velocity] = await Promise.all([
    Task.find({ sprint: sprint._id }).select('status complexity assignee').lean(),
    User.countDocuments({ _id: { $in: project.members }, isActive: true }),
    historicalVelocity(project._id),
  ]);
  const measures = measureTasks(tasks);
  const asOf = isoDate(new Date());
  const answer = parseAnswer(
    await aiClient.request('/api/v1/ai/sprints/predict-risk', {
      method: 'POST',
      json: {
        sprint: { startDate: isoDate(sprint.startDate), endDate: isoDate(sprint.endDate), asOf },
        tasks: measures,
        team: { size: teamSize, historicalVelocity: velocity },
      },
    }),
  );
  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    },
    asOf,
    riskLevel: answer.riskLevel,
    probability: answer.probability,
    method: answer.method,
    factors: answer.factors.map(({ code, label, impact }) => ({ code, label, impact })),
    measures: { ...measures, teamSize, historicalVelocity: velocity },
    features: answer.features,
    model: answer.model,
    warnings: answer.warnings,
  };
}

module.exports = { predictSprintRisk, historicalVelocity };
