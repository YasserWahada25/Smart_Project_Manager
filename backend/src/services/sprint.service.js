const { Sprint, SPRINT_STATUSES } = require('../models/sprint.model');
const { Project } = require('../models/project.model');
const { Task, TASK_STATUSES } = require('../models/task.model');
const ApiError = require('../utils/ApiError');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const access = require('./projectAccess.service');
const activityService = require('./activity.service');

const EDITABLE_FIELDS = ['name', 'objective', 'startDate', 'endDate'];

function pickDefined(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

/** Loads a sprint and its project; 404 if either is missing or the project is not visible. */
async function findViewableSprint(sprintId, user) {
  const sprint = await Sprint.findById(sprintId);
  const project = sprint && (await Project.findById(sprint.project));
  if (!sprint || !project || !access.canViewProject(project, user)) {
    throw ApiError.notFound('Sprint not found');
  }
  return { sprint, project };
}

async function findManagedSprint(sprintId, user) {
  const { sprint, project } = await findViewableSprint(sprintId, user);
  access.assertManager(project, user);
  access.assertNotArchived(project);
  return { sprint, project };
}

function emptyStats() {
  const tasksByStatus = Object.fromEntries(Object.values(TASK_STATUSES).map((status) => [status, 0]));
  return { totalTasks: 0, completedTasks: 0, blockedTasks: 0, totalPoints: 0, completedPoints: 0, progress: 0, tasksByStatus };
}

/**
 * Task statistics per sprint, in one aggregation. progress = completed story points / total
 * story points (%), so a large task weighs more than a small one.
 */
async function computeSprintStats(sprintIds) {
  const rows = await Task.aggregate([
    { $match: { sprint: { $in: sprintIds } } },
    {
      $group: {
        _id: { sprint: '$sprint', status: '$status' },
        count: { $sum: 1 },
        points: { $sum: '$complexity' },
      },
    },
  ]);

  const statsBySprint = new Map(sprintIds.map((id) => [String(id), emptyStats()]));
  rows.forEach(({ _id, count, points }) => {
    const stats = statsBySprint.get(String(_id.sprint));
    stats.tasksByStatus[_id.status] = count;
    stats.totalTasks += count;
    stats.totalPoints += points;
    if (_id.status === TASK_STATUSES.DONE) {
      stats.completedTasks = count;
      stats.completedPoints = points;
    }
    if (_id.status === TASK_STATUSES.BLOCKED) stats.blockedTasks = count;
  });
  statsBySprint.forEach((stats) => {
    stats.progress = stats.totalPoints === 0 ? 0 : Math.round((stats.completedPoints / stats.totalPoints) * 100);
  });
  return statsBySprint;
}

async function withStats(sprints) {
  const statsBySprint = await computeSprintStats(sprints.map((sprint) => sprint._id));
  return sprints.map((sprint) => ({ ...sprint.toJSON(), stats: statsBySprint.get(sprint.id) }));
}

function assertSprintOpen(sprint) {
  if (sprint.isClosed()) {
    throw ApiError.conflict(`The sprint is ${sprint.status.toLowerCase()} and can no longer be modified`);
  }
}

async function createSprint(actor, projectId, data) {
  const project = await access.findManagedProject(projectId, actor);
  const sprint = await Sprint.create({ ...pickDefined(data, EDITABLE_FIELDS), project: project._id });
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.SPRINT_CREATED,
    sprint,
    details: { name: sprint.name },
  });
  return sprint;
}

/** Sprints of a project, in chronological order. Filter: status. */
async function listSprints(actor, projectId, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit, status } = {}) {
  const project = await access.findViewableProject(projectId, actor);
  const filter = { project: project._id };
  if (status) filter.status = status;

  const [sprints, total] = await Promise.all([
    Sprint.find(filter)
      .sort({ startDate: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Sprint.countDocuments(filter),
  ]);
  return { data: await withStats(sprints), pagination: buildPagination(page, limit, total) };
}

async function getSprint(actor, sprintId) {
  const { sprint } = await findViewableSprint(sprintId, actor);
  const [withStatistics] = await withStats([sprint]);
  return withStatistics;
}

async function updateSprint(actor, sprintId, updates) {
  const { sprint, project } = await findManagedSprint(sprintId, actor);
  assertSprintOpen(sprint);

  const fields = pickDefined(updates, EDITABLE_FIELDS);
  if (Object.keys(fields).length === 0) {
    throw ApiError.badRequest(`Provide at least one field to update: ${EDITABLE_FIELDS.join(', ')}`);
  }
  Object.assign(sprint, fields);
  const changed = activityService.changedFields(sprint, EDITABLE_FIELDS);
  await sprint.save();
  if (changed.length > 0) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.SPRINT_UPDATED,
      sprint,
      details: { name: sprint.name, fields: changed },
    });
  }
  return sprint;
}

async function changeSprintStatus(actor, sprintId, status) {
  const { sprint, project } = await findManagedSprint(sprintId, actor);

  if (!sprint.canTransitionTo(status)) {
    throw ApiError.conflict(`Invalid status transition: ${sprint.status} → ${status}`);
  }
  if (status === SPRINT_STATUSES.ACTIVE) {
    const active = await Sprint.findOne({ project: project._id, status: SPRINT_STATUSES.ACTIVE });
    if (active) {
      throw ApiError.conflict(`The project already has an active sprint: ${active.name}`);
    }
  }

  const previousStatus = sprint.status;
  sprint.status = status;
  if (status === SPRINT_STATUSES.COMPLETED) sprint.completedAt = new Date();

  try {
    await sprint.save();
  } catch (err) {
    // Concurrent activation caught by the unique partial index.
    if (err.code === 11000) throw ApiError.conflict('The project already has an active sprint');
    throw err;
  }
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.SPRINT_STATUS_CHANGED,
    sprint,
    details: { name: sprint.name, from: previousStatus, to: status },
  });
  return sprint;
}

/**
 * Only PLANNED sprints can be deleted (started sprints are kept for history: cancel them
 * instead). Their tasks go back to the backlog.
 */
async function deleteSprint(actor, sprintId) {
  const { sprint, project } = await findManagedSprint(sprintId, actor);
  if (sprint.status !== SPRINT_STATUSES.PLANNED) {
    throw ApiError.conflict('Only PLANNED sprints can be deleted; cancel this sprint instead');
  }
  await Task.updateMany({ sprint: sprint._id }, { sprint: null });
  await sprint.deleteOne();
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.SPRINT_DELETED,
    sprint,
    details: { name: sprint.name },
  });
}

module.exports = {
  findViewableSprint,
  findManagedSprint,
  computeSprintStats,
  createSprint,
  listSprints,
  getSprint,
  updateSprint,
  changeSprintStatus,
  deleteSprint,
};
