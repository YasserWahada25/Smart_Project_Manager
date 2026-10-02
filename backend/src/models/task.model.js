const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const TASK_TYPES = Object.freeze({
  FEATURE: 'FEATURE',
  BUG: 'BUG',
  IMPROVEMENT: 'IMPROVEMENT',
  TESTING: 'TESTING',
  DOCUMENTATION: 'DOCUMENTATION',
  DEVOPS: 'DEVOPS',
  SECURITY: 'SECURITY',
});

const TASK_PRIORITIES = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' });

// Higher weight = more urgent (Kanban ordering, dashboards).
const PRIORITY_WEIGHTS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });

const TASK_STATUSES = Object.freeze({
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  CODE_REVIEW: 'CODE_REVIEW',
  TESTING: 'TESTING',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
});

// Kanban columns, in workflow order (BLOCKED is shown separately).
const WORKFLOW_COLUMNS = Object.freeze(['TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE']);

const TASK_TRANSITIONS = Object.freeze({
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['TODO', 'CODE_REVIEW', 'BLOCKED'],
  CODE_REVIEW: ['IN_PROGRESS', 'TESTING', 'BLOCKED'],
  TESTING: ['IN_PROGRESS', 'CODE_REVIEW', 'DONE', 'BLOCKED'],
  DONE: ['IN_PROGRESS'], // reopen
  BLOCKED: ['TODO', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING'],
});

// Statuses in which somebody must be working on the task.
const STATUSES_REQUIRING_ASSIGNEE = Object.freeze(['IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'DONE']);

// Complexity expressed in story points (Fibonacci scale). >= 8 is considered "high complexity".
const COMPLEXITY_POINTS = Object.freeze([1, 2, 3, 5, 8, 13]);
const HIGH_COMPLEXITY_THRESHOLD = 8;

const TASK_LIMITS = Object.freeze({
  titleMaxLength: 200,
  descriptionMaxLength: 5000,
  maxRequiredSkills: 20,
  skillMaxLength: 50,
  blockedReasonMaxLength: 500,
});

const { ObjectId } = mongoose.Schema.Types;

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: TASK_LIMITS.titleMaxLength },
    description: { type: String, trim: true, maxlength: TASK_LIMITS.descriptionMaxLength, default: '' },
    type: { type: String, enum: Object.values(TASK_TYPES), default: TASK_TYPES.FEATURE },
    priority: { type: String, enum: Object.values(TASK_PRIORITIES), default: TASK_PRIORITIES.MEDIUM },
    complexity: {
      type: Number,
      default: 3,
      validate: {
        validator: (value) => COMPLEXITY_POINTS.includes(value),
        message: `Complexity must be one of: ${COMPLEXITY_POINTS.join(', ')}`,
      },
    },
    status: { type: String, enum: Object.values(TASK_STATUSES), default: TASK_STATUSES.TODO },
    deadline: { type: Date },
    requiredSkills: {
      type: [{ type: String, trim: true, maxlength: TASK_LIMITS.skillMaxLength }],
      default: [],
      validate: {
        validator: (values) => values.length <= TASK_LIMITS.maxRequiredSkills,
        message: `A task can have at most ${TASK_LIMITS.maxRequiredSkills} required skills`,
      },
    },
    project: { type: ObjectId, ref: 'Project', required: true },
    // null = backlog (not planned in a sprint)
    sprint: { type: ObjectId, ref: 'Sprint', default: null },
    // null = unassigned; must be a member of the project
    assignee: { type: ObjectId, ref: 'User', default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    blockedReason: { type: String, trim: true, maxlength: TASK_LIMITS.blockedReasonMaxLength },
    // Set when the task reaches DONE, removed if it is reopened.
    completedAt: { type: Date },
  },
  { timestamps: true },
);

taskSchema.virtual('isOverdue').get(function isOverdue() {
  return Boolean(this.deadline) && this.status !== TASK_STATUSES.DONE && this.deadline.getTime() < Date.now();
});

taskSchema.methods.canTransitionTo = function canTransitionTo(status) {
  return TASK_TRANSITIONS[this.status].includes(status);
};

// Project task list / Kanban board, sprint board & statistics, "my tasks".
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ sprint: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });

taskSchema.plugin(toJSONPlugin);

const Task = mongoose.model('Task', taskSchema);

module.exports = {
  Task,
  TASK_TYPES,
  TASK_PRIORITIES,
  PRIORITY_WEIGHTS,
  TASK_STATUSES,
  WORKFLOW_COLUMNS,
  TASK_TRANSITIONS,
  STATUSES_REQUIRING_ASSIGNEE,
  COMPLEXITY_POINTS,
  HIGH_COMPLEXITY_THRESHOLD,
  TASK_LIMITS,
};
