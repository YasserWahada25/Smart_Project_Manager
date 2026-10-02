const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const NOTIFICATION_TYPES = Object.freeze({
  ADDED_TO_PROJECT: 'ADDED_TO_PROJECT',
  REMOVED_FROM_PROJECT: 'REMOVED_FROM_PROJECT',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UNASSIGNED: 'TASK_UNASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  SPRINT_STARTED: 'SPRINT_STARTED',
});

// Notifications are short-lived: MongoDB deletes them automatically after 90 days.
const NOTIFICATION_TTL_SECONDS = 90 * 24 * 60 * 60;

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    message: { type: String, required: true, maxlength: 300 },
    actor: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    task: { type: ObjectId, ref: 'Task' },
    sprint: { type: ObjectId, ref: 'Sprint' },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "My notifications" (optionally unread only), newest first, and the unread counter.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Automatic clean-up.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });

notificationSchema.plugin(toJSONPlugin);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES, NOTIFICATION_TTL_SECONDS };
