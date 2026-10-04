const { body, param } = require('express-validator');
const { mongoIdParam } = require('./common.validator');
const { ASSISTANT_LIMITS, WRITE_TOOLS } = require('../services/aiAssistant.service');

const projectIdRule = mongoIdParam('id', 'project');

/** The visible conversation (user / assistant texts), the last message being the manager's question. */
const chatRules = [
  projectIdRule,
  body('messages')
    .isArray({ min: 1, max: ASSISTANT_LIMITS.maxMessages })
    .withMessage(`messages must be an array of 1 to ${ASSISTANT_LIMITS.maxMessages} messages`)
    .bail()
    .custom((messages) => messages[messages.length - 1]?.role === 'user')
    .withMessage('The last message must be a user message'),
  body('messages.*.role').isIn(['user', 'assistant']).withMessage('role must be user or assistant'),
  body('messages.*.content')
    .isString()
    .withMessage('content must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: ASSISTANT_LIMITS.messageMaxLength })
    .withMessage(`content must be 1 to ${ASSISTANT_LIMITS.messageMaxLength} characters`),
];

const proposalIdRule = (chain) => chain.isUUID().withMessage('Invalid proposal id');

/**
 * A proposal confirmed by the manager: its arguments are validated by the usual task / sprint rules.
 * With a proposalId, the saved proposal is applied (tool and arguments are then not needed).
 */
const actionRules = [
  projectIdRule,
  proposalIdRule(body('proposalId').optional()),
  body('tool')
    .if(body('proposalId').not().exists())
    .isIn(WRITE_TOOLS)
    .withMessage(`tool must be one of: ${WRITE_TOOLS.join(', ')}`),
  body('arguments')
    .if(body('proposalId').not().exists())
    .custom((value) => value !== null && typeof value === 'object' && !Array.isArray(value))
    .withMessage('arguments must be an object'),
];

const conversationRules = [projectIdRule];

const dismissRules = [projectIdRule, proposalIdRule(param('proposalId'))];

module.exports = { chatRules, actionRules, conversationRules, dismissRules };
