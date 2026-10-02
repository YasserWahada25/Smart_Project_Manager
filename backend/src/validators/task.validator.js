const { body, query } = require('express-validator');
const {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  COMPLEXITY_POINTS,
  TASK_LIMITS,
} = require('../models/task.model');
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

const TYPES = Object.values(TASK_TYPES);
const PRIORITIES = Object.values(TASK_PRIORITIES);
const STATUSES = Object.values(TASK_STATUSES);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const projectIdRule = mongoIdParam('id', 'project');
const taskIdRule = mongoIdParam('id', 'task');

/** Body reference: an ObjectId, or null to clear it. */
const nullableRefRule = (field, label, { optional = true } = {}) => {
  const chain = body(field)
    .custom((value) => value === null || (typeof value === 'string' && OBJECT_ID_PATTERN.test(value)))
    .withMessage(`${label} must be a valid id or null`);
  return optional ? chain.optional() : chain;
};

/** Query reference: an ObjectId or a keyword (e.g. "backlog", "unassigned"). */
const refQueryRule = (name, keyword) =>
  query(name)
    .optional()
    .custom((value) => value === keyword || OBJECT_ID_PATTERN.test(value))
    .withMessage(`${name} must be a valid id or "${keyword}"`);

const commonFieldRules = (optional) => [
  textRule('title', 'Title', TASK_LIMITS.titleMaxLength, { optional }),
  optionalTextRule('description', 'Description', TASK_LIMITS.descriptionMaxLength),
  body('type').optional().isIn(TYPES).withMessage(`Type must be one of: ${TYPES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`),
  body('complexity')
    .optional()
    .custom((value) => COMPLEXITY_POINTS.includes(value))
    .withMessage(`Complexity must be one of (story points): ${COMPLEXITY_POINTS.join(', ')}`),
  dateRule('deadline', 'Deadline', { optional: true, nullable: true }),
  stringListRule('requiredSkills', 'requiredSkills', {
    maxItems: TASK_LIMITS.maxRequiredSkills,
    maxLength: TASK_LIMITS.skillMaxLength,
  }),
  nullableRefRule('sprint', 'Sprint'),
];

const createTaskRules = [projectIdRule, ...commonFieldRules(false), nullableRefRule('assignee', 'Assignee')];

const updateTaskRules = [taskIdRule, ...commonFieldRules(true)];

const listTasksRules = [
  projectIdRule,
  ...paginationRules,
  enumQueryRule('status', STATUSES),
  enumQueryRule('priority', PRIORITIES),
  enumQueryRule('type', TYPES),
  refQueryRule('assignee', 'unassigned'),
  refQueryRule('sprint', 'backlog'),
  searchQueryRule('search'),
  query('overdue')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('overdue must be "true" or "false"')
    .customSanitizer((value) => value === 'true'),
];

const boardRules = [projectIdRule, refQueryRule('sprint', 'backlog')];

const taskIdRules = [taskIdRule];

const changeStatusRules = [
  taskIdRule,
  body('status').isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(', ')}`),
  optionalTextRule('blockedReason', 'Blocked reason', TASK_LIMITS.blockedReasonMaxLength),
];

const assignRules = [taskIdRule, nullableRefRule('assigneeId', 'assigneeId', { optional: false })];

const myTasksRules = [...paginationRules, enumQueryRule('status', STATUSES)];

module.exports = {
  createTaskRules,
  updateTaskRules,
  listTasksRules,
  boardRules,
  taskIdRules,
  changeStatusRules,
  assignRules,
  myTasksRules,
};
