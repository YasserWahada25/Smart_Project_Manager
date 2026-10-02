const { Notification, NOTIFICATION_TYPES } = require('../models/notification.model');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const { SPRINT_STATUSES } = require('../models/sprint.model');
const { Project } = require('../models/project.model');
const { Task } = require('../models/task.model');
const { User } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { sameId } = require('../utils/ids');
const activityService = require('./activity.service');

const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : 'Someone');

/** Removes duplicates and the actor: nobody is notified of their own action. */
function recipientsExcept(actorId, candidates) {
  const unique = new Map();
  candidates.filter(Boolean).forEach((id) => unique.set(String(id), id));
  return [...unique.values()].filter((id) => !sameId(id, actorId));
}

/**
 * Turns an activity into notifications: who must know about it, and with which message.
 * Returns [] for activities that do not notify anybody.
 */
async function buildNotifications(activity) {
  const [project, actor] = await Promise.all([
    Project.findById(activity.project).select('name manager members'),
    User.findById(activity.actor).select('firstName lastName'),
  ]);
  if (!project) return [];

  const who = fullName(actor);
  const title = activity.details?.title;
  const base = { actor: activity.actor, project: activity.project, task: activity.task, sprint: activity.sprint };
  const notify = (type, recipients, message) =>
    recipientsExcept(activity.actor, recipients).map((recipient) => ({ ...base, type, recipient, message }));

  switch (activity.type) {
    case ACTIVITY_TYPES.MEMBER_ADDED:
      return notify(NOTIFICATION_TYPES.ADDED_TO_PROJECT, [activity.targetUser], `${who} added you to the project «${project.name}»`);
    case ACTIVITY_TYPES.MEMBER_REMOVED:
      return notify(NOTIFICATION_TYPES.REMOVED_FROM_PROJECT, [activity.targetUser], `${who} removed you from the project «${project.name}»`);
    case ACTIVITY_TYPES.TASK_ASSIGNED:
      return notify(NOTIFICATION_TYPES.TASK_ASSIGNED, [activity.targetUser], `${who} assigned you the task «${title}»`);
    case ACTIVITY_TYPES.TASK_UNASSIGNED:
      return notify(NOTIFICATION_TYPES.TASK_UNASSIGNED, [activity.targetUser], `${who} unassigned you from the task «${title}»`);
    case ACTIVITY_TYPES.TASK_STATUS_CHANGED:
    case ACTIVITY_TYPES.COMMENT_ADDED: {
      const task = await Task.findById(activity.task).select('assignee');
      const recipients = [project.manager, task?.assignee];
      return activity.type === ACTIVITY_TYPES.COMMENT_ADDED
        ? notify(NOTIFICATION_TYPES.COMMENT_ADDED, recipients, `${who} commented on «${title}»`)
        : notify(
            NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
            recipients,
            `${who} moved «${title}» from ${activity.details.from} to ${activity.details.to}`,
          );
    }
    case ACTIVITY_TYPES.SPRINT_STATUS_CHANGED:
      if (activity.details?.to !== SPRINT_STATUSES.ACTIVE) return [];
      return notify(
        NOTIFICATION_TYPES.SPRINT_STARTED,
        project.members,
        `The sprint «${activity.details.name}» has started in «${project.name}»`,
      );
    default:
      return [];
  }
}

async function notifyFromActivity(activity) {
  const notifications = await buildNotifications(activity);
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
}

let listenerRegistered = false;

/** Subscribes notifications to the activity history (idempotent; called when the app is created). */
function registerActivityListener() {
  if (listenerRegistered) return;
  listenerRegistered = true;
  activityService.onActivity(notifyFromActivity);
}

const POPULATE = { path: 'actor', select: 'firstName lastName' };

async function listNotifications(user, { page = PAGINATION.defaultPage, limit = PAGINATION.defaultLimit, unread } = {}) {
  const filter = { recipient: user._id };
  if (unread) filter.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: user._id, read: false }),
  ]);
  return { data: notifications, pagination: buildPagination(page, limit, total), unreadCount };
}

async function countUnread(user) {
  return Notification.countDocuments({ recipient: user._id, read: false });
}

/** A user can only act on their own notifications (others are reported as not found). */
async function findOwnNotification(user, notificationId) {
  const notification = await Notification.findOne({ _id: notificationId, recipient: user._id });
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }
  return notification;
}

async function markAsRead(user, notificationId) {
  const notification = await findOwnNotification(user, notificationId);
  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }
  return notification.populate(POPULATE);
}

async function markAllAsRead(user) {
  const result = await Notification.updateMany(
    { recipient: user._id, read: false },
    { read: true, readAt: new Date() },
  );
  return result.modifiedCount;
}

async function deleteNotification(user, notificationId) {
  const notification = await findOwnNotification(user, notificationId);
  await notification.deleteOne();
}

module.exports = {
  buildNotifications,
  registerActivityListener,
  listNotifications,
  countUnread,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
