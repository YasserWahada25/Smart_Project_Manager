const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const PROPOSAL_STATES = Object.freeze({
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  DISMISSED: 'DISMISSED',
  FAILED: 'FAILED',
});

const CONVERSATION_LIMITS = Object.freeze({
  maxStoredMessages: 200, // oldest messages are dropped beyond this
  replyMaxLength: 10000,
  resultMaxLength: 500,
});

const { ObjectId } = mongoose.Schema.Types;

const proposalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    tool: { type: String, required: true },
    // Stored as JSON text: the keys come from the LLM and must not be read as MongoDB operators.
    argumentsJson: { type: String, required: true },
    summary: { type: String, required: true },
    state: { type: String, enum: Object.values(PROPOSAL_STATES), default: PROPOSAL_STATES.PENDING },
    result: { type: String, maxlength: CONVERSATION_LIMITS.resultMaxLength },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: CONVERSATION_LIMITS.replyMaxLength },
    proposals: { type: [proposalSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// AI-04: the conversation of a manager with the assistant of a project (one per manager and project).
const assistantConversationSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

assistantConversationSchema.index({ project: 1, user: 1 }, { unique: true });

assistantConversationSchema.plugin(toJSONPlugin);

const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema);

module.exports = { AssistantConversation, PROPOSAL_STATES, CONVERSATION_LIMITS };
