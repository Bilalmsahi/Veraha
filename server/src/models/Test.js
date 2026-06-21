/**
 * Test Model (Tenant Domain)
 *
 * A compliance check that may pass via automation, manual evidence, or both.
 * Phase 1: manual evidence uses linked Evidence + EvidenceVersion flow; automation fields are forward-compatible.
 */
import mongoose from 'mongoose';
import {
  TEST_TYPE,
  TEST_CATEGORY,
  TEST_RENEWAL_PERIOD,
  TEST_ROLLOUT,
  TEST_STATUS,
  TEST_AUTOMATION_RESULT,
} from './enums.js';
import tenantPlugin from './plugins/tenantPlugin.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

const DAYS_SOON = 30;
const MS_PER_DAY = 86400000;

/**
 * Automation config for future integrations (aligned with InternalControl.automationConfig).
 */
const testAutomationConfigSchema = new Schema(
  {
    provider: { type: String, trim: true },
    integrationId: { type: String, trim: true },
    checkType: { type: String, trim: true },
    parameters: { type: Schema.Types.Mixed },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
  },
  { _id: false }
);

const testSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    /** Dedup key when seeding from external JSON */
    notionId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    evidenceGuidance: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: TEST_CATEGORY,
      default: 'Engineering',
    },
    type: {
      type: String,
      enum: TEST_TYPE,
      default: 'document',
    },
    /** Omit or leave unset when not applicable */
    renewalPeriod: {
      type: String,
      enum: TEST_RENEWAL_PERIOD,
    },
    rollout: {
      type: String,
      enum: TEST_ROLLOUT,
      default: 'enabled',
    },
    /** Persisted computed health (recalculate on save and via service) */
    status: {
      type: String,
      enum: TEST_STATUS,
      default: 'ok',
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    lastRenewedAt: {
      type: Date,
      default: null,
    },
    lastPassedAt: {
      type: Date,
      default: null,
    },
    /** False = out of scope / deactivated */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    /**
     * Used for restore logic when toggling inactive/snoozed states via workflow services.
     * Kept intentionally unconstrained in Phase 1 (Phase 3 will enforce transitions).
     */
    previousWorkflowStatus: {
      type: String,
      default: null,
    },
    skipStatusRecompute: {
      type: Boolean,
      default: false,
    },
    /** While set and in the future, test is treated as N/A */
    snoozedUntil: {
      type: Date,
      default: null,
    },
    snoozeReason: {
      type: String,
      trim: true,
      default: '',
    },
    deactivationReason: {
      type: String,
      trim: true,
      default: '',
    },
    notApplicableAt: {
      type: Date,
      default: null,
      index: true,
    },
    notApplicableBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notApplicableReason: {
      type: String,
      trim: true,
      default: '',
    },
    // Archive (separate from soft delete) for readiness overlays
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    archiveReason: {
      type: String,
      trim: true,
      default: '',
    },
    linkedControlIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InternalControl',
      },
    ],
    /** Manual proof: one Evidence document per test when uploads exist */
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    automationConfig: testAutomationConfigSchema,
    lastAutomationRunAt: {
      type: Date,
      default: null,
    },
    lastAutomationResult: {
      type: String,
      enum: TEST_AUTOMATION_RESULT,
      default: 'NOT_CONFIGURED',
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
    collection: 'tests',
  }
);

/**
 * Basic health from due dates + scope. Extend later for automation / remediation rules.
 */
testSchema.methods.recalculateStatus = function recalculateStatus() {
  const now = new Date();

  if (!this.dueDate) {
    this.status = 'ok';
    return;
  }

  const due = new Date(this.dueDate);
  const msUntilDue = due.getTime() - now.getTime();
  const daysUntilDue = msUntilDue / MS_PER_DAY;

  if (daysUntilDue < 0) {
    this.status = 'overdue';
    return;
  }
  if (daysUntilDue <= DAYS_SOON) {
    this.status = 'due_soon';
    return;
  }
  this.status = 'ok';
};

testSchema.pre('save', async function preSave() {
  const previousStatus = this.isNew ? null : this.get('status');
  if (!this.skipStatusRecompute) {
    this.recalculateStatus();
  }
  if (this.status === 'ok' && (this.isNew || this.isModified('status') || previousStatus !== 'ok')) {
    this.lastPassedAt = new Date();
  }
});

testSchema.index({ organizationId: 1, status: 1 });
testSchema.index({ organizationId: 1, type: 1 });
testSchema.index({ organizationId: 1, category: 1 });
testSchema.index({ organizationId: 1, rollout: 1 });
testSchema.index({ organizationId: 1, linkedControlIds: 1 });

testSchema.plugin(tenantPlugin);
testSchema.plugin(applyOrgScope, 'organizationId');

const Test = mongoose.model('Test', testSchema);

export default Test;
