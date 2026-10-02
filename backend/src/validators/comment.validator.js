const { COMMENT_LIMITS } = require('../models/comment.model');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const { mongoIdParam, paginationRules, enumQueryRule, textRule } = require('./common.validator');

const contentRule = () => textRule('content', 'Content', COMMENT_LIMITS.contentMaxLength);

const listCommentsRules = [mongoIdParam('id', 'task'), ...paginationRules];
const createCommentRules = [mongoIdParam('id', 'task'), contentRule()];
const updateCommentRules = [mongoIdParam('id', 'comment'), contentRule()];
const commentIdRules = [mongoIdParam('id', 'comment')];

const projectActivitiesRules = [
  mongoIdParam('id', 'project'),
  ...paginationRules,
  enumQueryRule('type', Object.values(ACTIVITY_TYPES)),
];
const taskActivitiesRules = [mongoIdParam('id', 'task'), ...paginationRules];

module.exports = {
  listCommentsRules,
  createCommentRules,
  updateCommentRules,
  commentIdRules,
  projectActivitiesRules,
  taskActivitiesRules,
};
