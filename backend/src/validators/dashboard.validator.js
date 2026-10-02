const { query } = require('express-validator');
const { mongoIdParam } = require('./common.validator');

const projectDashboardRules = [mongoIdParam('id', 'project')];

const searchRules = [
  query('q')
    .isString()
    .withMessage('q is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('q must be between 2 and 100 characters'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('limit must be an integer between 1 and 20').toInt(),
];

module.exports = { projectDashboardRules, searchRules };
