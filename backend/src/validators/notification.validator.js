const { query } = require('express-validator');
const { mongoIdParam, paginationRules } = require('./common.validator');

const listNotificationsRules = [
  ...paginationRules,
  query('unread')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('unread must be "true" or "false"')
    .customSanitizer((value) => value === 'true'),
];

const notificationIdRules = [mongoIdParam('id', 'notification')];

module.exports = { listNotificationsRules, notificationIdRules };
