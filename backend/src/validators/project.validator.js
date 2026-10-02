const { body } = require('express-validator');
const { PROJECT_STATUSES, PROJECT_LIMITS } = require('../models/project.model');
const {
  mongoIdParam,
  paginationRules,
  searchQueryRule,
  enumQueryRule,
  textRule,
  optionalTextRule,
  dateRule,
  stringListRule,
} = require('./common.validator');

const STATUSES = Object.values(PROJECT_STATUSES);

const projectIdRule = mongoIdParam('id', 'project');

const statusRule = body('status')
  .optional()
  .isIn(STATUSES)
  .withMessage(`Status must be one of: ${STATUSES.join(', ')}`);

const technologiesRule = stringListRule('technologies', 'technologies', {
  maxItems: PROJECT_LIMITS.maxTechnologies,
  maxLength: PROJECT_LIMITS.technologyMaxLength,
});

const createProjectRules = [
  textRule('name', 'Project name', PROJECT_LIMITS.nameMaxLength),
  optionalTextRule('description', 'Description', PROJECT_LIMITS.descriptionMaxLength),
  dateRule('startDate', 'Start date'),
  dateRule('deadline', 'Deadline', { optional: true, nullable: true }),
  statusRule,
  technologiesRule,
];

const updateProjectRules = [
  projectIdRule,
  textRule('name', 'Project name', PROJECT_LIMITS.nameMaxLength, { optional: true }),
  optionalTextRule('description', 'Description', PROJECT_LIMITS.descriptionMaxLength),
  dateRule('startDate', 'Start date', { optional: true }),
  dateRule('deadline', 'Deadline', { optional: true, nullable: true }),
  statusRule,
  technologiesRule,
];

const listProjectsRules = [...paginationRules, enumQueryRule('status', STATUSES), searchQueryRule('search')];

const projectIdRules = [projectIdRule];

const addMemberRules = [projectIdRule, body('userId').isMongoId().withMessage('Invalid user id')];

const removeMemberRules = [projectIdRule, mongoIdParam('userId', 'user')];

module.exports = {
  createProjectRules,
  updateProjectRules,
  listProjectsRules,
  projectIdRules,
  addMemberRules,
  removeMemberRules,
};
