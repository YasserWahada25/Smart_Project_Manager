const { Activity } = require('../models/activity.model');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const logger = require('../utils/logger');
const access = require('./projectAccess.service');

const POPULATE = [
  { path: 'actor', select: 'firstName lastName' },
  { path: 'targetUser', select: 'firstName lastName' },
];

// Listeners called after each recorded activity (e.g. notifications). Registered at startup.
const listeners = [];

function onActivity(listener) {
  listeners.push(listener);
}

async function notifyListeners(activity) {
  for (const listener of listeners) {
    try {
      await listener(activity);
    } catch (err) {
      logger.error(`Activity listener failed for ${activity.type}:`, err.message);
    }
  }
}

/**
 * Records an activity. History is secondary data: a failure is logged but never makes the
 * main operation (which already succeeded) fail.
 */
async function record({ project, actor, type, task, sprint, targetUser, details = {} }) {
  try {
    const activity = await Activity.create({
      project: project._id ?? project,
      actor: actor._id ?? actor,
      type,
      task: task?._id ?? task,
      sprint: sprint?._id ?? sprint,
      targetUser: targetUser?._id ?? targetUser,
      details,
    });
    await notifyListeners(activity);
    return activity;
  } catch (err) {
    logger.error(`Failed to record activity ${type}:`, err.message);
    return null;
  }
}

/** Paginated activities matching a filter, newest first. */
async function paginateActivities(filter, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit }) {
  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Activity.countDocuments(filter),
  ]);
  return { data: activities, pagination: buildPagination(page, limit, total) };
}

/** Project history, newest first. Filter: type. */
async function listProjectActivities(actor, projectId, { type, ...pagination } = {}) {
  const project = await access.findViewableProject(projectId, actor);
  const filter = { project: project._id };
  if (type) filter.type = type;
  return paginateActivities(filter, pagination);
}

/** Names of the fields whose value changed in a document about to be saved. */
function changedFields(doc, fields) {
  return fields.filter((field) => doc.isModified(field));
}

module.exports = { record, onActivity, paginateActivities, listProjectActivities, changedFields };
