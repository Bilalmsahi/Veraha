import crypto from 'crypto';
import mongoose from 'mongoose';
import tenantPlugin from './plugins/tenantPlugin.js';

const { Schema } = mongoose;

const trainingModuleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    frameworkTags: [
      {
        type: String,
        trim: true,
      },
    ],
    estimatedReadMinutes: {
      type: Number,
      min: 1,
      default: 12,
    },
    contentMarkdown: {
      type: String,
      default: '',
    },
    contentHtml: {
      type: String,
      default: '',
    },
    contentHash: {
      type: String,
      trim: true,
      default: '',
    },
    quiz: {
      passingScore: { type: Number, default: 0.8, min: 0, max: 1 },
      maxAttempts: { type: Number, default: 3, min: 1 },
      retryDelayHours: { type: Number, default: 24, min: 0 },
      questionsPerAttempt: { type: Number, default: 6, min: 1 },
      questions: { type: [Schema.Types.Mixed], default: [] },
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
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
    collection: 'training_modules',
  }
);

trainingModuleSchema.pre('save', function setContentHash() {
  if (!this.contentHash || this.isModified('contentMarkdown') || this.isModified('contentHtml') || this.isModified('quiz')) {
    const hashSource = JSON.stringify({
      contentMarkdown: this.contentMarkdown || '',
      contentHtml: this.contentHtml || '',
      quiz: this.quiz || {},
    });
    this.contentHash = crypto.createHash('sha256').update(hashSource).digest('hex');
  }
});

trainingModuleSchema.index(
  { organizationId: 1, moduleKey: 1, version: 1 },
  { unique: true }
);
trainingModuleSchema.plugin(tenantPlugin);

const TrainingModule = mongoose.model('TrainingModule', trainingModuleSchema);

export default TrainingModule;
