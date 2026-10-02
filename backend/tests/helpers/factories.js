// Test data builders. Each call creates distinct documents (unique emails).
const { User, ROLES } = require('../../src/models/user.model');
const { Project } = require('../../src/models/project.model');
const { Sprint } = require('../../src/models/sprint.model');
const { Task } = require('../../src/models/task.model');
const { signAccessToken } = require('../../src/services/token.service');

const PASSWORD = 'Secret123';
let sequence = 0;

function createUser(overrides = {}) {
  sequence += 1;
  return User.create({
    firstName: `User${sequence}`,
    lastName: 'Test',
    email: `user${sequence}@example.com`,
    password: PASSWORD,
    role: ROLES.DEVELOPER,
    ...overrides,
  });
}

const createAdmin = (overrides) => createUser({ role: ROLES.ADMIN, ...overrides });
const createManager = (overrides) => createUser({ role: ROLES.PROJECT_MANAGER, ...overrides });
const createDeveloper = (overrides) => createUser({ role: ROLES.DEVELOPER, ...overrides });

function createProject(manager, overrides = {}) {
  sequence += 1;
  return Project.create({
    name: `Project ${sequence}`,
    startDate: new Date('2026-01-01'),
    manager: manager._id,
    ...overrides,
  });
}

function createSprint(project, overrides = {}) {
  sequence += 1;
  return Sprint.create({
    name: `Sprint ${sequence}`,
    project: project._id,
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-14'),
    ...overrides,
  });
}

function createTask(project, overrides = {}) {
  sequence += 1;
  return Task.create({
    title: `Task ${sequence}`,
    project: project._id,
    createdBy: project.manager,
    ...overrides,
  });
}

/** Value for the Authorization header. */
const bearer = (user) => `Bearer ${signAccessToken(user)}`;

module.exports = {
  PASSWORD,
  createUser,
  createAdmin,
  createManager,
  createDeveloper,
  createProject,
  createSprint,
  createTask,
  bearer,
};
