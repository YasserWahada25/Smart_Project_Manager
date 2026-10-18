const { body, param } = require('express-validator');
const { mongoIdParam } = require('./common.validator');

const sprintIdRule = mongoIdParam('id', 'sprint');

/** GET / POST /sprints/:id/ai/retrospective */
const retrospectiveRules = [sprintIdRule];

/** A task created from an action of the retrospective, in an open sprint of the project or the backlog (null). */
const actionTaskRules = [
  sprintIdRule,
  param('actionId').isUUID().withMessage('Invalid action id'),
  body('sprint')
    .optional({ values: 'null' })
    .isMongoId()
    .withMessage('sprint must be a sprint id or null (backlog)'),
];

module.exports = { retrospectiveRules, actionTaskRules };
