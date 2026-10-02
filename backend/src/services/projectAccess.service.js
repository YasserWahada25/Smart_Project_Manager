/**
 * Project-level access rules, shared by projects, sprints, tasks, comments…
 *
 *  - ADMIN: can view every project (platform supervision), cannot modify them.
 *  - Project manager (project.manager): can view and modify the project.
 *  - Member (project.members): can view the project.
 *  - Anyone else: the project is reported as not found (its existence is not revealed).
 */
const { Project, PROJECT_STATUSES } = require('../models/project.model');
const { ROLES } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { sameId } = require('../utils/ids');

function isAdmin(user) {
  return user.role === ROLES.ADMIN;
}

function isProjectManager(project, user) {
  return sameId(project.manager, user);
}

function isProjectMember(project, user) {
  return project.members.some((member) => sameId(member, user));
}

function canViewProject(project, user) {
  return isAdmin(user) || isProjectManager(project, user) || isProjectMember(project, user);
}

/** MongoDB filter selecting the projects a user can view. */
function visibleProjectsFilter(user) {
  if (isAdmin(user)) return {};
  return { $or: [{ manager: user._id }, { members: user._id }] };
}

function assertCanView(project, user) {
  if (!project || !canViewProject(project, user)) {
    throw ApiError.notFound('Project not found');
  }
}

function assertManager(project, user) {
  if (!isProjectManager(project, user)) {
    throw ApiError.forbidden('Only the project manager can perform this action');
  }
}

function assertNotArchived(project) {
  if (project.status === PROJECT_STATUSES.ARCHIVED) {
    throw ApiError.conflict('The project is archived: change its status before modifying it');
  }
}

async function findViewableProject(projectId, user) {
  const project = await Project.findById(projectId);
  assertCanView(project, user);
  return project;
}

/** Loads a project the user manages; archived projects are refused unless allowArchived. */
async function findManagedProject(projectId, user, { allowArchived = false } = {}) {
  const project = await findViewableProject(projectId, user);
  assertManager(project, user);
  if (!allowArchived) assertNotArchived(project);
  return project;
}

module.exports = {
  isAdmin,
  isProjectManager,
  isProjectMember,
  canViewProject,
  visibleProjectsFilter,
  assertCanView,
  assertManager,
  assertNotArchived,
  findViewableProject,
  findManagedProject,
};
