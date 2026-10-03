const { body } = require('express-validator');
const { TASK_TYPES, TASK_PRIORITIES, COMPLEXITY_POINTS, TASK_LIMITS } = require('../models/task.model');
const { SPRINT_LIMITS } = require('../models/sprint.model');
const { mongoIdParam, textRule, optionalTextRule, dateRule, stringListRule } = require('./common.validator');

/** Limits of AI-01 (planning from a specification), shared with the service. */
const PLAN_LIMITS = Object.freeze({
  textMinLength: 20,
  textMaxLength: 200000,
  maxSprints: 20,
  maxTasks: 100,
  epicMaxLength: 100,
  sprintLengthDays: Object.freeze({ min: 5, max: 30, default: 14 }),
  capacityPerSprint: Object.freeze({ min: 3, max: 200, default: 20 }),
  methods: Object.freeze(['llm', 'local']),
});

const TYPES = Object.values(TASK_TYPES);
const PRIORITIES = Object.values(TASK_PRIORITIES);

const projectIdRule = mongoIdParam('id', 'project');

// Multipart form fields arrive as strings: integers are converted here.
const generatePlanRules = [
  projectIdRule,
  body('text')
    .optional()
    .isString()
    .withMessage('text must be a string')
    .bail()
    .isLength({ max: PLAN_LIMITS.textMaxLength })
    .withMessage(`text must be at most ${PLAN_LIMITS.textMaxLength} characters`),
  body('sprintLengthDays')
    .optional()
    .isInt(PLAN_LIMITS.sprintLengthDays)
    .withMessage(
      `sprintLengthDays must be an integer between ${PLAN_LIMITS.sprintLengthDays.min} and ${PLAN_LIMITS.sprintLengthDays.max}`,
    )
    .toInt(),
  body('capacityPerSprint')
    .optional()
    .isInt(PLAN_LIMITS.capacityPerSprint)
    .withMessage(
      `capacityPerSprint must be an integer between ${PLAN_LIMITS.capacityPerSprint.min} and ${PLAN_LIMITS.capacityPerSprint.max}`,
    )
    .toInt(),
  dateRule('startDate', 'Start date', { optional: true }),
];

/** A task of the reviewed plan (`prefix` = "sprints.*.tasks.*" or "backlog.*"). */
const planTaskRules = (prefix) => [
  textRule(`${prefix}.title`, 'Title', TASK_LIMITS.titleMaxLength),
  optionalTextRule(`${prefix}.description`, 'Description', TASK_LIMITS.descriptionMaxLength),
  body(`${prefix}.type`).isIn(TYPES).withMessage(`Type must be one of: ${TYPES.join(', ')}`),
  body(`${prefix}.priority`).isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`),
  body(`${prefix}.complexity`)
    .custom((value) => COMPLEXITY_POINTS.includes(value))
    .withMessage(`Complexity must be one of (story points): ${COMPLEXITY_POINTS.join(', ')}`),
  stringListRule(`${prefix}.requiredSkills`, 'requiredSkills', {
    maxItems: TASK_LIMITS.maxRequiredSkills,
    maxLength: TASK_LIMITS.skillMaxLength,
  }),
];

const applyPlanRules = [
  projectIdRule,
  body('sprints')
    .isArray({ max: PLAN_LIMITS.maxSprints })
    .withMessage(`sprints must be an array of at most ${PLAN_LIMITS.maxSprints} sprints`),
  textRule('sprints.*.name', 'Sprint name', SPRINT_LIMITS.nameMaxLength),
  optionalTextRule('sprints.*.objective', 'Objective', SPRINT_LIMITS.objectiveMaxLength),
  dateRule('sprints.*.startDate', 'Start date'),
  dateRule('sprints.*.endDate', 'End date'),
  body('sprints.*.tasks')
    .isArray({ max: PLAN_LIMITS.maxTasks })
    .withMessage(`tasks must be an array of at most ${PLAN_LIMITS.maxTasks} tasks`),
  ...planTaskRules('sprints.*.tasks.*'),
  body('backlog')
    .optional()
    .isArray({ max: PLAN_LIMITS.maxTasks })
    .withMessage(`backlog must be an array of at most ${PLAN_LIMITS.maxTasks} tasks`),
  ...planTaskRules('backlog.*'),
  body('method')
    .optional()
    .isIn(PLAN_LIMITS.methods)
    .withMessage(`method must be one of: ${PLAN_LIMITS.methods.join(', ')}`),
];

module.exports = { PLAN_LIMITS, generatePlanRules, applyPlanRules };
