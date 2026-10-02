const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const SPRINT_STATUSES = Object.freeze({
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

// Allowed lifecycle: PLANNED → ACTIVE → COMPLETED; PLANNED/ACTIVE → CANCELLED.
// COMPLETED and CANCELLED are final.
const SPRINT_TRANSITIONS = Object.freeze({
  PLANNED: [SPRINT_STATUSES.ACTIVE, SPRINT_STATUSES.CANCELLED],
  ACTIVE: [SPRINT_STATUSES.COMPLETED, SPRINT_STATUSES.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
});

const CLOSED_SPRINT_STATUSES = [SPRINT_STATUSES.COMPLETED, SPRINT_STATUSES.CANCELLED];

const SPRINT_LIMITS = Object.freeze({ nameMaxLength: 100, objectiveMaxLength: 1000 });

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sprint name is required'],
      trim: true,
      maxlength: SPRINT_LIMITS.nameMaxLength,
    },
    objective: {
      type: String,
      trim: true,
      maxlength: SPRINT_LIMITS.objectiveMaxLength,
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: Object.values(SPRINT_STATUSES),
      default: SPRINT_STATUSES.PLANNED,
    },
    // Set when the sprint becomes COMPLETED (used for velocity / risk prediction).
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

sprintSchema.pre('validate', function checkDates() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be on or after the start date');
  }
});

sprintSchema.methods.canTransitionTo = function canTransitionTo(status) {
  return SPRINT_TRANSITIONS[this.status].includes(status);
};

sprintSchema.methods.isClosed = function isClosed() {
  return CLOSED_SPRINT_STATUSES.includes(this.status);
};

// Sprint list of a project, in chronological order.
sprintSchema.index({ project: 1, startDate: 1 });
// Database-level guarantee: at most one ACTIVE sprint per project, even under concurrent requests.
sprintSchema.index(
  { project: 1 },
  { unique: true, partialFilterExpression: { status: SPRINT_STATUSES.ACTIVE }, name: 'one_active_sprint_per_project' },
);

sprintSchema.plugin(toJSONPlugin);

const Sprint = mongoose.model('Sprint', sprintSchema);

module.exports = { Sprint, SPRINT_STATUSES, SPRINT_TRANSITIONS, CLOSED_SPRINT_STATUSES, SPRINT_LIMITS };
