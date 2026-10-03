const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const ACTIVITY_TYPES = Object.freeze({
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  SPRINT_CREATED: 'SPRINT_CREATED',
  SPRINT_UPDATED: 'SPRINT_UPDATED',
  SPRINT_STATUS_CHANGED: 'SPRINT_STATUS_CHANGED',
  SPRINT_DELETED: 'SPRINT_DELETED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UNASSIGNED: 'TASK_UNASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_DELETED: 'TASK_DELETED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  // AI-01: sprints and tasks created from a reviewed AI plan (details: { sprints, tasks, method }).
  AI_PLAN_APPLIED: 'AI_PLAN_APPLIED',
});

const { ObjectId } = mongoose.Schema.Types;

/**
 * Append-only history of what happened in a project. `details` holds a small snapshot
 * (e.g. { title }, { from, to }, { fields }) so entries stay readable after the related
 * task or sprint is deleted.
 */
const activitySchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    actor: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(ACTIVITY_TYPES), required: true },
    task: { type: ObjectId, ref: 'Task' },
    sprint: { type: ObjectId, ref: 'Sprint' },
    // User affected by the action (member added/removed, new assignee).
    targetUser: { type: ObjectId, ref: 'User' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Project history and task history, newest first.
activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });

activitySchema.plugin(toJSONPlugin);

const Activity = mongoose.model('Activity', activitySchema);

module.exports = { Activity, ACTIVITY_TYPES };
