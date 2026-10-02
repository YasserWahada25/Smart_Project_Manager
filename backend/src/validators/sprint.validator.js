const { body } = require('express-validator');
const { SPRINT_STATUSES, SPRINT_LIMITS } = require('../models/sprint.model');
const { mongoIdParam, paginationRules, enumQueryRule, textRule, optionalTextRule, dateRule } = require('./common.validator');

const STATUSES = Object.values(SPRINT_STATUSES);

const projectIdRule = mongoIdParam('id', 'project');
const sprintIdRule = mongoIdParam('id', 'sprint');

const createSprintRules = [
  projectIdRule,
  textRule('name', 'Sprint name', SPRINT_LIMITS.nameMaxLength),
  optionalTextRule('objective', 'Objective', SPRINT_LIMITS.objectiveMaxLength),
  dateRule('startDate', 'Start date'),
  dateRule('endDate', 'End date'),
];

const listSprintsRules = [projectIdRule, ...paginationRules, enumQueryRule('status', STATUSES)];

const sprintIdRules = [sprintIdRule];

const updateSprintRules = [
  sprintIdRule,
  textRule('name', 'Sprint name', SPRINT_LIMITS.nameMaxLength, { optional: true }),
  optionalTextRule('objective', 'Objective', SPRINT_LIMITS.objectiveMaxLength),
  dateRule('startDate', 'Start date', { optional: true }),
  dateRule('endDate', 'End date', { optional: true }),
];

const changeStatusRules = [
  sprintIdRule,
  body('status')
    .isIn(STATUSES)
    .withMessage(`Status must be one of: ${STATUSES.join(', ')}`),
];

module.exports = { createSprintRules, listSprintsRules, sprintIdRules, updateSprintRules, changeStatusRules };
