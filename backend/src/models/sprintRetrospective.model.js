const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');
const { TASK_TYPES, TASK_PRIORITIES } = require('./task.model');

const RETROSPECTIVE_LIMITS = Object.freeze({
  maxItems: 6, // delivered, slipped, blockers
  maxOpinions: 5, // wentWell, toImprove
  maxActions: 5,
  itemMaxLength: 300,
  summaryMaxLength: 1200,
  actionTitleMaxLength: 120,
  actionDescriptionMaxLength: 500,
});

const { ObjectId } = mongoose.Schema.Types;

const text = (max) => ({ type: String, maxlength: max });

const actionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { ...text(RETROSPECTIVE_LIMITS.actionTitleMaxLength), required: true },
    description: { ...text(RETROSPECTIVE_LIMITS.actionDescriptionMaxLength), default: '' },
    type: { type: String, enum: Object.values(TASK_TYPES), required: true },
    priority: { type: String, enum: Object.values(TASK_PRIORITIES), required: true },
    // Task created from this action by the manager (once).
    task: { type: ObjectId, ref: 'Task', default: null },
  },
  { _id: false },
);

/**
 * AI-05: retrospective of a completed sprint (one per sprint, replaced when regenerated). The metrics are
 * computed by code; the texts are written by the LLM or by rules (`method`).
 */
const sprintRetrospectiveSchema = new mongoose.Schema(
  {
    sprint: { type: ObjectId, ref: 'Sprint', required: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    method: { type: String, enum: ['llm', 'local'], required: true },
    model: { type: String, default: null },
    summary: { ...text(RETROSPECTIVE_LIMITS.summaryMaxLength), required: true },
    delivered: [text(RETROSPECTIVE_LIMITS.itemMaxLength)],
    slipped: [text(RETROSPECTIVE_LIMITS.itemMaxLength)],
    blockers: [text(RETROSPECTIVE_LIMITS.itemMaxLength)],
    wentWell: [text(RETROSPECTIVE_LIMITS.itemMaxLength)],
    toImprove: [text(RETROSPECTIVE_LIMITS.itemMaxLength)],
    actions: { type: [actionSchema], default: [] },
    metrics: { type: mongoose.Schema.Types.Mixed, required: true },
    warnings: [text(500)],
    generatedBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

sprintRetrospectiveSchema.index({ sprint: 1 }, { unique: true });
sprintRetrospectiveSchema.index({ project: 1 });

sprintRetrospectiveSchema.plugin(toJSONPlugin);

const SprintRetrospective = mongoose.model('SprintRetrospective', sprintRetrospectiveSchema);

module.exports = { SprintRetrospective, RETROSPECTIVE_LIMITS };
