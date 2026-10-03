const {
  Task,
  TASK_STATUSES,
  WORKFLOW_COLUMNS,
  PRIORITY_WEIGHTS,
  STATUSES_REQUIRING_ASSIGNEE,
} = require('../models/task.model');
const { Project } = require('../models/project.model');
const { Sprint } = require('../models/sprint.model');
const { User } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { containsInsensitive } = require('../utils/regex');
const { sameId } = require('../utils/ids');
const { Comment } = require('../models/comment.model');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const access = require('./projectAccess.service');
const activityService = require('./activity.service');

const EDITABLE_FIELDS = ['title', 'description', 'type', 'priority', 'complexity', 'deadline', 'requiredSkills', 'sprint'];
const USER_SUMMARY = 'firstName lastName email';
const POPULATE = [
  { path: 'assignee', select: USER_SUMMARY },
  { path: 'createdBy', select: USER_SUMMARY },
];

function pickDefined(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

/** Loads a task and its project; 404 if the task does not exist or its project is not visible. */
async function findViewableTask(taskId, user) {
  const task = await Task.findById(taskId);
  const project = task && (await Project.findById(task.project));
  if (!task || !project || !access.canViewProject(project, user)) {
    throw ApiError.notFound('Task not found');
  }
  return { task, project };
}

async function findManagedTask(taskId, user) {
  const { task, project } = await findViewableTask(taskId, user);
  access.assertManager(project, user);
  access.assertNotArchived(project);
  return { task, project };
}

/** A task can only be planned in an open sprint of its own project (null = backlog). */
async function assertValidSprint(project, sprintId) {
  if (sprintId === null || sprintId === undefined) return;
  const sprint = await Sprint.findById(sprintId);
  if (!sprint || !sameId(sprint.project, project)) {
    throw ApiError.badRequest('Validation failed', [{ field: 'sprint', message: 'Sprint not found in this project' }]);
  }
  if (sprint.isClosed()) {
    throw ApiError.conflict(`Tasks cannot be added to a ${sprint.status.toLowerCase()} sprint`);
  }
}

async function assertValidAssignee(project, assigneeId) {
  if (assigneeId === null || assigneeId === undefined) return;
  if (!access.isProjectMember(project, assigneeId)) {
    throw ApiError.badRequest('Validation failed', [
      { field: 'assignee', message: 'The assignee must be a member of the project' },
    ]);
  }
  const user = await User.findById(assigneeId).select('isActive');
  if (!user || !user.isActive) {
    throw ApiError.badRequest('Validation failed', [{ field: 'assignee', message: 'The assignee account is deactivated' }]);
  }
}

async function createTask(actor, projectId, data) {
  const project = await access.findManagedProject(projectId, actor);
  const fields = pickDefined(data, EDITABLE_FIELDS);
  await assertValidSprint(project, fields.sprint);
  await assertValidAssignee(project, data.assignee);

  const task = await Task.create({
    ...fields,
    assignee: data.assignee ?? null,
    project: project._id,
    createdBy: actor._id,
  });

  const details = { title: task.title };
  await activityService.record({ project, actor, type: ACTIVITY_TYPES.TASK_CREATED, task, details });
  if (task.assignee) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.TASK_ASSIGNED,
      task,
      targetUser: task.assignee,
      details,
    });
  }
  return task.populate(POPULATE);
}

function buildTaskFilter(projectId, { status, priority, type, assignee, sprint, search, overdue }) {
  const filter = { project: projectId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (type) filter.type = type;
  if (assignee) filter.assignee = assignee === 'unassigned' ? null : assignee;
  if (sprint) filter.sprint = sprint === 'backlog' ? null : sprint;
  if (search) filter.title = containsInsensitive(search);
  if (overdue) {
    filter.deadline = { $lt: new Date() };
    filter.status = filter.status ?? { $ne: TASK_STATUSES.DONE };
  }
  return filter;
}

/** Tasks of a project (newest first) with filters: status, priority, type, assignee, sprint, search, overdue. */
async function listTasks(actor, projectId, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit, ...filters } = {}) {
  const project = await access.findViewableProject(projectId, actor);
  const filter = buildTaskFilter(project._id, filters);

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Task.countDocuments(filter),
  ]);
  return { data: tasks, pagination: buildPagination(page, limit, total) };
}

async function getTask(actor, taskId) {
  const { task } = await findViewableTask(taskId, actor);
  return task.populate(POPULATE);
}

async function updateTask(actor, taskId, updates) {
  const { task, project } = await findManagedTask(taskId, actor);
  const fields = pickDefined(updates, EDITABLE_FIELDS);
  if (Object.keys(fields).length === 0) {
    throw ApiError.badRequest(`Provide at least one field to update: ${EDITABLE_FIELDS.join(', ')}`);
  }
  if (fields.sprint !== undefined && !sameId(fields.sprint, task.sprint)) {
    await assertValidSprint(project, fields.sprint);
  }

  Object.assign(task, fields);
  if (fields.deadline === null) task.deadline = undefined;
  const changed = activityService.changedFields(task, EDITABLE_FIELDS);
  await task.save();
  if (changed.length > 0) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.TASK_UPDATED,
      task,
      details: { title: task.title, fields: changed },
    });
  }
  return task.populate(POPULATE);
}

/**
 * Workflow transition. Allowed for the project manager and for the task's assignee
 * ("developers update the status of their own tasks").
 */
async function changeTaskStatus(actor, taskId, { status, blockedReason }) {
  const { task, project } = await findViewableTask(taskId, actor);
  access.assertNotArchived(project);

  if (!access.isProjectManager(project, actor) && !sameId(task.assignee, actor)) {
    throw ApiError.forbidden('Only the project manager or the assignee can change the status of this task');
  }
  if (!task.canTransitionTo(status)) {
    throw ApiError.conflict(`Invalid status transition: ${task.status} → ${status}`);
  }
  if (STATUSES_REQUIRING_ASSIGNEE.includes(status) && !task.assignee) {
    throw ApiError.conflict('Assign the task to a developer before moving it to ' + status);
  }

  const previousStatus = task.status;
  task.status = status;
  task.blockedReason = status === TASK_STATUSES.BLOCKED ? blockedReason : undefined;
  task.completedAt = status === TASK_STATUSES.DONE ? new Date() : undefined;
  await task.save();
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.TASK_STATUS_CHANGED,
    task,
    details: { title: task.title, from: previousStatus, to: status },
  });
  return task.populate(POPULATE);
}

/** Assigns the task to a project member, or unassigns it (assigneeId = null) while it is not in progress. */
async function assignTask(actor, taskId, assigneeId) {
  const { task, project } = await findManagedTask(taskId, actor);

  if (assigneeId === null) {
    if (STATUSES_REQUIRING_ASSIGNEE.includes(task.status)) {
      throw ApiError.conflict(`A task in ${task.status} must keep an assignee: move it back to TODO first`);
    }
  } else {
    await assertValidAssignee(project, assigneeId);
  }

  const previousAssignee = task.assignee;
  task.assignee = assigneeId;
  await task.save();

  if (assigneeId === null && previousAssignee) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.TASK_UNASSIGNED,
      task,
      targetUser: previousAssignee,
      details: { title: task.title },
    });
  } else if (assigneeId !== null && !sameId(previousAssignee, assigneeId)) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.TASK_ASSIGNED,
      task,
      targetUser: assigneeId,
      details: { title: task.title },
    });
  }
  return task.populate(POPULATE);
}

/** Deletes the task and its comments; its history is kept (TASK_DELETED keeps the title). */
async function deleteTask(actor, taskId) {
  const { task, project } = await findManagedTask(taskId, actor);
  await Comment.deleteMany({ task: task._id });
  await task.deleteOne();
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.TASK_DELETED,
    task,
    details: { title: task.title },
  });
}

/** History of one task, newest first. */
async function listTaskActivities(actor, taskId, pagination = {}) {
  const { task } = await findViewableTask(taskId, actor);
  return activityService.paginateActivities({ task: task._id }, pagination);
}

function byPriorityThenAge(a, b) {
  return PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority] || a.createdAt - b.createdAt;
}

/**
 * Kanban board of a project: one column per workflow status (+ BLOCKED), tasks ordered
 * by priority then age. sprint: a sprint id, "backlog" (tasks without sprint) or omitted (all tasks).
 */
async function getBoard(actor, projectId, { sprint } = {}) {
  const project = await access.findViewableProject(projectId, actor);

  let sprintInfo = null;
  if (sprint && sprint !== 'backlog') {
    const found = await Sprint.findOne({ _id: sprint, project: project._id });
    if (!found) throw ApiError.notFound('Sprint not found');
    sprintInfo = { id: found.id, name: found.name, status: found.status };
  }

  const tasks = await Task.find(buildTaskFilter(project._id, { sprint })).populate({
    path: 'assignee',
    select: USER_SUMMARY,
  });
  tasks.sort(byPriorityThenAge);

  const columns = [...WORKFLOW_COLUMNS, TASK_STATUSES.BLOCKED].map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));
  columns.forEach((column) => {
    column.count = column.tasks.length;
  });

  return {
    project: { id: project.id, name: project.name, status: project.status },
    sprint: sprintInfo,
    scope: sprint === 'backlog' ? 'BACKLOG' : sprintInfo ? 'SPRINT' : 'ALL',
    totalTasks: tasks.length,
    columns,
  };
}

/**
 * Tasks assigned to the current user in the projects they can still see, ordered by
 * deadline (tasks without deadline last).
 */
async function listMyTasks(actor, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit, status } = {}) {
  const projectIds = await Project.find(access.visibleProjectsFilter(actor)).distinct('_id');
  const filter = { assignee: actor._id, project: { $in: projectIds } };
  if (status) filter.status = status;

  const [tasks, total] = await Promise.all([
    Task.aggregate([
      { $match: filter },
      { $addFields: { hasDeadline: { $cond: [{ $ifNull: ['$deadline', false] }, 0, 1] } } },
      { $sort: { hasDeadline: 1, deadline: 1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]),
    Task.countDocuments(filter),
  ]);

  const ids = tasks.map((task) => task._id);
  const docs = await Task.find({ _id: { $in: ids } }).populate([
    { path: 'project', select: 'name status' },
    { path: 'sprint', select: 'name status' },
  ]);
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return { data: ids.map((id) => byId.get(String(id))), pagination: buildPagination(page, limit, total) };
}

module.exports = {
  findViewableTask,
  findManagedTask,
  createTask,
  listTasks,
  getTask,
  updateTask,
  changeTaskStatus,
  assignTask,
  deleteTask,
  listTaskActivities,
  getBoard,
  listMyTasks,
};
