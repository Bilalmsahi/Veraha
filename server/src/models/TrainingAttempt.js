import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const trainingAttemptSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingModule',
      required: true,
      index: true,
    },
    moduleVersion: {
      type: Number,
      required: true,
    },
    cycleKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    readProgressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    readCompletedAt: {
      type: Date,
      default: null,
    },
    quizScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastFailedAt: {
      type: Date,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    passedAt: {
      type: Date,
      default: null,
      index: true,
    },
    certificateEvidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    quizSession: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'submitted'],
        default: 'not_started',
      },
      selectedQuestionIds: { type: [String], default: [] },
      optionOrderByQuestion: {
        type: Map,
        of: [String],
        default: undefined,
      },
      startedAt: { type: Date, default: null },
      submittedAt: { type: Date, default: null },
      answers: {
        type: [
          {
            questionId: String,
            selectedOptionId: String,
            isCorrect: Boolean,
          },
        ],
        default: [],
      },
      scorePercent: { type: Number, min: 0, max: 1, default: null },
      correctCount: { type: Number, min: 0, default: null },
      totalQuestions: { type: Number, min: 0, default: null },
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'training_attempts',
  }
);

trainingAttemptSchema.index(
  { organizationId: 1, userId: 1, moduleId: 1, cycleKey: 1 },
  { unique: true }
);
trainingAttemptSchema.plugin(tenantPlugin);

const TrainingAttempt = mongoose.model('TrainingAttempt', trainingAttemptSchema);

export default TrainingAttempt;
