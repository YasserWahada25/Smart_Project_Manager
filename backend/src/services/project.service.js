const { Project, PROJECT_STATUSES, PROJECT_LIMITS } = require('../models/project.model');
const { User, ROLES } = require('../models/user.model');
const { Sprint } = require('../models/sprint.model');
const { Task, TASK_STATUSES } = require('../models/task.model');
const ApiError = require('../utils/ApiError');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { containsInsensitive } = require('../utils/regex');
const { sameId } = require('../utils/ids');
const { Activity, ACTIVITY_TYPES } = require('../models/activity.model');
const { Notification } = require('../models/notification.model');
const { AssistantConversation } = require('../models/assistantConversation.model');
const access = require('./projectAccess.service');
const activityService = require('./activity.service');

const MANAGER_FIELDS = 'firstName lastName email jobTitle';
const MEMBER_FIELDS = 'firstName lastName email jobTitle skills isActive';
const EDITABLE_FIELDS = ['name', 'description', 'startDate', 'deadline', 'status', 'technologies'];

const POPULATE = [
  { path: 'manager', select: MANAGER_FIELDS },
  { path: 'members', select: MEMBER_FIELDS },
];

function pickDefined(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

async function createProject(actor, data) {
  const fields = pickDefined(data, EDITABLE_FIELDS);
  if (fields.status === PROJECT_STATUSES.ARCHIVED) {
    throw ApiError.badRequest('A project cannot be created as ARCHIVED');
  }
  const project = await Project.create({ ...fields, manager: actor._id });
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.PROJECT_CREATED,
    details: { name: project.name },
  });
  return project.populate(POPULATE);
}

/** Projects visible to the actor, newest first. Filters: status, search (name). */
async function listProjects(actor, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit, status, search } = {}) {
  const filter = { ...access.visibleProjectsFilter(actor) };
  if (status) filter.status = status;
  if (search) filter.name = containsInsensitive(search);

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Project.countDocuments(filter),
  ]);

  return { data: projects, pagination: buildPagination(page, limit, total) };
}

async function getProject(actor, projectId) {
  const project = await access.findViewableProject(projectId, actor);
  return project.populate(POPULATE);
}

/**
 * Partial update by the project manager. An archived project only accepts a status
 * change (to un-archive it); `deadline: null` removes the deadline.
 */
async function updateProject(actor, projectId, updates) {
  const project = await access.findManagedProject(projectId, actor, { allowArchived: true });
  const fields = pickDefined(updates, EDITABLE_FIELDS);
  const fieldNames = Object.keys(fields);

  if (fieldNames.length === 0) {
    throw ApiError.badRequest(`Provide at least one field to update: ${EDITABLE_FIELDS.join(', ')}`);
  }
  if (project.status === PROJECT_STATUSES.ARCHIVED && fieldNames.some((field) => field !== 'status')) {
    access.assertNotArchived(project);
  }

  const previousStatus = project.status;
  Object.assign(project, fields);
  if (fields.deadline === null) project.deadline = undefined;
  const changed = activityService.changedFields(
    project,
    EDITABLE_FIELDS.filter((field) => field !== 'status'),
  );
  await project.save();

  if (project.status !== previousStatus) {
    await activityService.record({
      project,
      actor,
      type: ACTIVITY_TYPES.PROJECT_STATUS_CHANGED,
      details: { from: previousStatus, to: project.status },
    });
  }
  if (changed.length > 0) {
    await activityService.record({ project, actor, type: ACTIVITY_TYPES.PROJECT_UPDATED, details: { fields: changed } });
  }
  return project.populate(POPULATE);
}

/** Only an empty project can be deleted; a project with history must be archived instead. */
async function deleteProject(actor, projectId) {
  const project = await access.findManagedProject(projectId, actor, { allowArchived: true });
  const [hasSprints, hasTasks] = await Promise.all([
    Sprint.exists({ project: project._id }),
    Task.exists({ project: project._id }),
  ]);
  if (hasSprints || hasTasks) {
    throw ApiError.conflict('The project still has sprints or tasks: archive it instead of deleting it');
  }
  await project.deleteOne();
  // The history, notifications and assistant conversations of a deleted project would point to nothing.
  await Promise.all([
    Activity.deleteMany({ project: project._id }),
    Notification.deleteMany({ project: project._id }),
    AssistantConversation.deleteMany({ project: project._id }),
  ]);
}

async function addMember(actor, projectId, userId) {
  const project = await access.findManagedProject(projectId, actor);

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  if (user.role !== ROLES.DEVELOPER) {
    throw ApiError.badRequest('Only DEVELOPER accounts can be added as project members');
  }
  if (!user.isActive) {
    throw ApiError.badRequest('This user account is deactivated');
  }
  if (access.isProjectMember(project, user)) {
    throw ApiError.conflict('This user is already a member of the project');
  }
  if (project.members.length >= PROJECT_LIMITS.maxMembers) {
    throw ApiError.conflict(`A project can have at most ${PROJECT_LIMITS.maxMembers} members`);
  }

  project.members.push(user._id);
  await project.save();
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.MEMBER_ADDED,
    targetUser: user,
    details: { name: `${user.firstName} ${user.lastName}` },
  });
  return project.populate(POPULATE);
}

async function removeMember(actor, projectId, userId) {
  const project = await access.findManagedProject(projectId, actor);
  if (!project.members.some((member) => sameId(member, userId))) {
    throw ApiError.notFound('This user is not a member of the project');
  }
  const openTasks = await Task.countDocuments({
    project: project._id,
    assignee: userId,
    status: { $ne: TASK_STATUSES.DONE },
  });
  if (openTasks > 0) {
    throw ApiError.conflict(`This member still has ${openTasks} unfinished task(s) assigned: reassign them first`);
  }

  project.members.pull(userId);
  await project.save();
  await activityService.record({ project, actor, type: ACTIVITY_TYPES.MEMBER_REMOVED, targetUser: userId });
  return project.populate(POPULATE);
}

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
};
