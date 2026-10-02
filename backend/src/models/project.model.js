const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const PROJECT_STATUSES = Object.freeze({
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
});

const PROJECT_LIMITS = Object.freeze({
  nameMaxLength: 100,
  descriptionMaxLength: 2000,
  maxTechnologies: 30,
  technologyMaxLength: 50,
  maxMembers: 50,
});

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: PROJECT_LIMITS.nameMaxLength,
    },
    description: {
      type: String,
      trim: true,
      maxlength: PROJECT_LIMITS.descriptionMaxLength,
      default: '',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUSES),
      default: PROJECT_STATUSES.PLANNING,
    },
    technologies: {
      type: [{ type: String, trim: true, maxlength: PROJECT_LIMITS.technologyMaxLength }],
      default: [],
      validate: {
        validator: (values) => values.length <= PROJECT_LIMITS.maxTechnologies,
        message: `A project can have at most ${PROJECT_LIMITS.maxTechnologies} technologies`,
      },
    },
    // The PROJECT_MANAGER who created the project; the only user allowed to modify it.
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Team: DEVELOPER accounts working on the project.
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (values) => values.length <= PROJECT_LIMITS.maxMembers,
        message: `A project can have at most ${PROJECT_LIMITS.maxMembers} members`,
      },
    },
  },
  { timestamps: true },
);

// Runs on every validation (not only when `deadline` changes), so changing only the
// start date is checked too.
projectSchema.pre('validate', function checkDates() {
  if (this.deadline && this.startDate && this.deadline < this.startDate) {
    this.invalidate('deadline', 'Deadline must be on or after the start date');
  }
});

// "My projects" queries: projects managed by a user / projects where a user is a member.
projectSchema.index({ manager: 1 });
projectSchema.index({ members: 1 });

projectSchema.plugin(toJSONPlugin);

const Project = mongoose.model('Project', projectSchema);

module.exports = { Project, PROJECT_STATUSES, PROJECT_LIMITS };
