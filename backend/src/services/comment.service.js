const { Comment } = require('../models/comment.model');
const { Project } = require('../models/project.model');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const ApiError = require('../utils/ApiError');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { sameId } = require('../utils/ids');
const access = require('./projectAccess.service');
const activityService = require('./activity.service');
const { findViewableTask } = require('./task.service');

const POPULATE = { path: 'author', select: 'firstName lastName email' };

/** Comments of a task, oldest first. */
async function listComments(actor, taskId, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit } = {}) {
  const { task } = await findViewableTask(taskId, actor);
  const filter = { task: task._id };
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Comment.countDocuments(filter),
  ]);
  return { data: comments, pagination: buildPagination(page, limit, total) };
}

/** People working on the project (manager and members) can comment; admins only read. */
async function addComment(actor, taskId, content) {
  const { task, project } = await findViewableTask(taskId, actor);
  if (!access.isProjectManager(project, actor) && !access.isProjectMember(project, actor)) {
    throw ApiError.forbidden('Only the project manager and members can comment');
  }
  access.assertNotArchived(project);

  const comment = await Comment.create({ task: task._id, project: project._id, author: actor._id, content });
  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.COMMENT_ADDED,
    task,
    details: { title: task.title, commentId: comment.id },
  });
  return comment.populate(POPULATE);
}

async function findComment(actor, commentId) {
  const comment = await Comment.findById(commentId);
  const project = comment && (await Project.findById(comment.project));
  if (!comment || !project || !access.canViewProject(project, actor)) {
    throw ApiError.notFound('Comment not found');
  }
  access.assertNotArchived(project);
  return { comment, project };
}

/** Only the author can edit their comment. */
async function updateComment(actor, commentId, content) {
  const { comment } = await findComment(actor, commentId);
  if (!sameId(comment.author, actor)) {
    throw ApiError.forbidden('Only the author can edit this comment');
  }
  comment.content = content;
  comment.editedAt = new Date();
  await comment.save();
  return comment.populate(POPULATE);
}

/** The author or the project manager (moderation) can delete a comment. */
async function deleteComment(actor, commentId) {
  const { comment, project } = await findComment(actor, commentId);
  if (!sameId(comment.author, actor) && !access.isProjectManager(project, actor)) {
    throw ApiError.forbidden('Only the author or the project manager can delete this comment');
  }
  await comment.deleteOne();
}

module.exports = { listComments, addComment, updateComment, deleteComment };
