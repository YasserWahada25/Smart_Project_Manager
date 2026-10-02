const mongoose = require('mongoose');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const COMMENT_LIMITS = Object.freeze({ contentMaxLength: 2000 });

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'Task', required: true },
    // Copy of task.project (never changes): access checks and clean-up without loading the task.
    project: { type: ObjectId, ref: 'Project', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: COMMENT_LIMITS.contentMaxLength,
    },
    // Set when the author edits the comment.
    editedAt: { type: Date },
  },
  { timestamps: true },
);

// Comments of a task in chronological order.
commentSchema.index({ task: 1, createdAt: 1 });

commentSchema.plugin(toJSONPlugin);

const Comment = mongoose.model('Comment', commentSchema);

module.exports = { Comment, COMMENT_LIMITS };
