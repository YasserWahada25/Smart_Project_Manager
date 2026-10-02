const { body, query } = require('express-validator');
const { ROLES } = require('../models/user.model');
const { mongoIdParam, paginationRules, searchQueryRule, enumQueryRule } = require('./common.validator');

const ALL_ROLES = Object.values(ROLES);

const userIdRule = mongoIdParam('id', 'user');

const listUsersRules = [
  ...paginationRules,
  enumQueryRule('role', ALL_ROLES),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be "true" or "false"')
    .customSanitizer((value) => value === 'true'),
  searchQueryRule('search'),
];

const listDevelopersRules = [...paginationRules, searchQueryRule('search'), searchQueryRule('skill', 50)];

const getUserRules = [userIdRule];

const updateStatusRules = [
  userIdRule,
  body('isActive')
    .custom((value) => typeof value === 'boolean')
    .withMessage('isActive must be a boolean (true or false)'),
];

const updateRoleRules = [
  userIdRule,
  body('role')
    .isIn(ALL_ROLES)
    .withMessage(`Role must be one of: ${ALL_ROLES.join(', ')}`),
];

module.exports = { listUsersRules, listDevelopersRules, getUserRules, updateStatusRules, updateRoleRules };
