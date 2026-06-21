import mongoose from 'mongoose';
import {
  MANUAL_STATUS,
  AUTOMATION_STATUS,
  FREQUENCY,
  COVERAGE,
} from './enums.js';
import tenantPlugin, { enhancedSoftDelete } from './plugins/tenantPlugin.js';
import { evaluateControlSatisfaction } from '../utils/readinessPredicates.js';
import { applyOrgScope } from '../../lib/orgScope.js';

const { Schema } = mongoose;

/**
 * Overall Status Enum
 * Unified status for dashboard display and sorting
 */
export const OVERALL_STATUS = ['PASS', 'FAIL', 'WARNING', 'NOT_APPLICABLE', 'NOT_CONFIGURED'];

/**
 * ControlRequirementMap Sub-Schema (Embedded)
 * 
 * Maps a control to framework requirements.
 * Allows one control to satisfy multiple frameworks simultaneously.
 */
const controlRequirementMapSchema = new Schema(
  {
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: 'Requirement',
      required: true,
    },
    frameworkId: {
      type: Schema.Types.ObjectId,
      ref: 'Framework',
      required: true,
    },
    coverage: {
      type: String,
      enum: COVERAGE,
      default: 'FULL',
    },
    justification: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * AutomationConfig Sub-Schema (Embedded)
 * 
 * Configuration for automated compliance checks.
 */
const automationConfigSchema = new Schema(
  {
    provider: {
      type: String,
      trim: true,
    },
    integrationId: {
      type: String,
    },
    checkType: {
      type: String,
      trim: true,
    },
    parameters: {
      type: Schema.Types.Mixed,
    },
    lastRunAt: {
      type: Date,
    },
    nextRunAt: {
      type: Date,
    },
  },
  { _id: false }
);

/**
 * InternalControl Model (Tenant Domain)
 * 
 * Represents a specific compliance control owned by an organization.
 * Core entity of the compliance engine - links to requirements, evidence, policies, and risks.
 */
const internalControlSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    sourceTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'GlobalControlTemplate',
      default: null,
    },
    identifier: {
      type: String,
      required: [true, 'Control identifier is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Control title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    /** Functional grouping (e.g. Asset Management) — not framework requirement category */
    controlGroup: {
      type: String,
      trim: true,
    },
    // Dual Status Tracking
    manualStatus: {
      type: String,
      enum: MANUAL_STATUS,
      default: 'NOT_APPLICABLE',
    },
    automationStatus: {
      type: String,
      enum: AUTOMATION_STATUS,
      default: 'NOT_CONFIGURED',
    },
    /**
     * Overall Status (Persisted for Dashboard Sorting)
     * 
     * CRITICAL FIX: This was previously a virtual which cannot be sorted/filtered by MongoDB.
     * Now persisted and auto-calculated on save.
     * 
     * Logic: If automation is configured (not 'NOT_CONFIGURED'), automation status takes precedence.
     *        Otherwise, falls back to manual status.
     */
    overallStatus: {
      type: String,
      enum: OVERALL_STATUS,
      default: 'NOT_CONFIGURED',
      index: true,
    },
    frequency: {
      type: String,
      enum: FREQUENCY,
      default: 'QUARTERLY',
    },
    isPurchased: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    suggestedPolicySlugs: [
      {
        type: String,
        trim: true,
      },
    ],
    // Embedded Framework Mappings (Many-to-Many without junction table)
    linkedRequirements: [controlRequirementMapSchema],
    // Related Policies
    linkedPolicyIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Policy',
      },
    ],
    // Related Risks (for mitigating controls)
    linkedRiskIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Risk',
      },
    ],
    // Automation Configuration
    automationConfig: automationConfigSchema,
    // Assessment Tracking
    lastAssessedAt: {
      type: Date,
    },
    lastAssessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    nextAssessmentDue: {
      type: Date,
    },
    implementationNotes: {
      type: String,
      trim: true,
    },
    // Soft Delete Fields
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
    collection: 'internalcontrols',
  }
);

// =============================================================================
// VIRTUALS
// =============================================================================

/**
 * Virtual for evidence count - useful for dashboard displays
 */
internalControlSchema.virtual('evidenceCount', {
  ref: 'Evidence',
  localField: '_id',
  foreignField: 'linkedControlIds',
  count: true,
});

/**
 * Virtual for linked risk count
 */
internalControlSchema.virtual('riskCount', {
  ref: 'Risk',
  localField: '_id',
  foreignField: 'mitigatingControlIds',
  count: true,
});

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Filter controls by overall status
 * @example InternalControl.find().forOrg(orgId).byStatus('FAIL')
 */
internalControlSchema.query.byStatus = function (status) {
  return this.where({ overallStatus: status });
};

/**
 * Filter controls by framework
 * @example InternalControl.find().forOrg(orgId).byFramework(frameworkId)
 */
internalControlSchema.query.byFramework = function (frameworkId) {
  return this.where({ 'linkedRequirements.frameworkId': frameworkId });
};

/**
 * Filter controls by control group (functional label, not framework requirement category)
 * @example InternalControl.find().forOrg(orgId).byControlGroup('Access Control')
 */
internalControlSchema.query.byControlGroup = function (controlGroup) {
  return this.where({ controlGroup });
};

/**
 * Filter controls that are due for assessment
 * @example InternalControl.find().forOrg(orgId).dueForAssessment()
 */
internalControlSchema.query.dueForAssessment = function () {
  return this.where({
    nextAssessmentDue: { $lte: new Date() },
    isDeleted: false,
  });
};

/**
 * Filter controls by owner
 * @example InternalControl.find().forOrg(orgId).byOwner(userId)
 */
internalControlSchema.query.byOwner = function (ownerId) {
  return this.where({ ownerId });
};

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validate linkedRequirements before saving
 * Ensures requirementId belongs to the specified frameworkId
 * Mongoose 9.x: Use async function without next callback
 */
internalControlSchema.pre('save', async function () {
  // Validate unique identifier per organization
  if (this.isNew || this.isModified('identifier')) {
    const exists = await this.constructor.findOne({
      organizationId: this.organizationId,
      identifier: this.identifier,
      _id: { $ne: this._id },
      isDeleted: false,
    });

    if (exists) {
      throw new Error(`Control identifier "${this.identifier}" already exists in this organization`);
    }
  }

  // Validate linkedRequirements
  if (this.isModified('linkedRequirements') && this.linkedRequirements && this.linkedRequirements.length > 0) {
    const Requirement = mongoose.model('Requirement');

    for (const link of this.linkedRequirements) {
      // Validate that requirement exists and belongs to framework
      const requirement = await Requirement.findOne({
        _id: link.requirementId,
        frameworkId: link.frameworkId,
        isActive: true,
      });

      if (!requirement) {
        throw new Error(
          `Requirement ${link.requirementId} does not exist or does not belong to framework ${link.frameworkId}`
        );
      }
    }
  }
});

/**
 * Validate linkedRequirements on update
 * Mongoose 9.x: Use async function without next callback
 */
internalControlSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  const linkedRequirements = update.linkedRequirements || update.$set?.linkedRequirements;

  if (linkedRequirements && linkedRequirements.length > 0) {
    const Requirement = mongoose.model('Requirement');

    for (const link of linkedRequirements) {
      const requirement = await Requirement.findOne({
        _id: link.requirementId,
        frameworkId: link.frameworkId,
        isActive: true,
      });

      if (!requirement) {
        throw new Error(
          `Requirement ${link.requirementId} does not exist or does not belong to framework ${link.frameworkId}`
        );
      }
    }
  }
});

// =============================================================================
// PRE-SAVE MIDDLEWARE: Calculate overallStatus
// =============================================================================

/**
 * Automatically calculate overallStatus before saving
 * Mongoose 9.x: No next callback needed
 * 
 * Priority Logic:
 * 1. If automationStatus is active (not 'NOT_CONFIGURED'), it overrides manualStatus
 * 2. If automationStatus is 'FAIL', overall is 'FAIL'
 * 3. If automationStatus is 'WARNING', overall is 'WARNING'
 * 4. If automationStatus is 'PASS', overall is 'PASS'
 * 5. Otherwise, use manualStatus
 */
internalControlSchema.pre('save', function () {
  // Check if automation is configured and active
  if (this.automationStatus && this.automationStatus !== 'NOT_CONFIGURED') {
    // Automation takes precedence
    switch (this.automationStatus) {
      case 'FAIL':
        this.overallStatus = 'FAIL';
        break;
      case 'WARNING':
        this.overallStatus = 'WARNING';
        break;
      case 'PASS':
        this.overallStatus = 'PASS';
        break;
      default:
        this.overallStatus = this.manualStatus;
    }
  } else {
    // Fall back to manual status
    this.overallStatus = this.manualStatus;
  }
});

/**
 * Also calculate on findOneAndUpdate to keep consistency
 * Mongoose 9.x: No next callback needed
 */
internalControlSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();

  // Only recalculate if relevant fields are being updated
  if (update.manualStatus !== undefined || update.automationStatus !== undefined) {
    const manualStatus = update.manualStatus || update.$set?.manualStatus;
    const automationStatus = update.automationStatus || update.$set?.automationStatus;

    // If we have both values, calculate overallStatus
    if (automationStatus && automationStatus !== 'NOT_CONFIGURED') {
      switch (automationStatus) {
        case 'FAIL':
          this.set({ overallStatus: 'FAIL' });
          break;
        case 'WARNING':
          this.set({ overallStatus: 'WARNING' });
          break;
        case 'PASS':
          this.set({ overallStatus: 'PASS' });
          break;
        default:
          if (manualStatus) {
            this.set({ overallStatus: manualStatus });
          }
      }
    } else if (manualStatus) {
      this.set({ overallStatus: manualStatus });
    }
  }
});

// =============================================================================
// STATIC METHODS - Basic Operations
// =============================================================================

/**
 * Recalculate overallStatus for all controls in an organization
 * Useful for bulk migrations or status refresh
 * @param {ObjectId} organizationId
 * @returns {Promise<number>} Number of updated documents
 */
internalControlSchema.statics.recalculateAllStatuses = async function (organizationId) {
  const controls = await this.find({ organizationId });
  let updatedCount = 0;

  for (const control of controls) {
    const originalStatus = control.overallStatus;
    await control.save(); // Triggers pre-save hook
    if (control.overallStatus !== originalStatus) {
      updatedCount++;
    }
  }

  return updatedCount;
};

/**
 * Phase 3: Re-evaluate readiness overlay for a single control.
 *
 * Note: InternalControl.overallStatus is already reserved for manual/automation status.
 * This method does NOT overwrite overallStatus; it returns a computed overlay object
 * that services/routes can use for readiness displays and cascades.
 *
 * @param {ObjectId} controlId
 * @param {ObjectId} organizationId
 */
internalControlSchema.statics.updateControlReadiness = async function (controlId, organizationId, options = {}) {
  const Policy = mongoose.model('Policy');
  const Test = mongoose.model('Test');
  const Evidence = mongoose.model('Evidence');
  const Risk = mongoose.model('Risk');
  const Organization = mongoose.model('Organization');

  const controlQuery = this.findOne({
    _id: controlId,
    organizationId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  })
    .select('_id identifier title manualStatus automationStatus overallStatus')
    .lean();
  if (options.session) controlQuery.session(options.session);
  const control = await controlQuery;

  if (!control) return null;

  const [organization, policies, tests, evidence, risks] = await Promise.all([
    Organization.findById(organizationId).select('settings').lean().session(options.session || null),
    Policy.find({ organizationId, isDeleted: { $ne: true }, linkedControlIds: controlId })
      .select('_id status workflowStatus requiresAttestation acknowledgementRate archivedAt')
      .lean()
      .session(options.session || null),
    Test.find({ organizationId, isDeleted: { $ne: true }, linkedControlIds: controlId })
      .select('_id status isActive snoozedUntil snoozeReason deactivationReason notApplicableAt notApplicableReason archivedAt archiveReason')
      .lean()
      .session(options.session || null),
    Evidence.find({ organizationId, isDeleted: { $ne: true }, linkedControlIds: controlId })
      .select('_id status archivedAt validUntil')
      .lean()
      .session(options.session || null),
    Risk.find({ organizationId, isDeleted: { $ne: true }, mitigatingControlIds: controlId })
      .select('_id status archivedAt')
      .lean()
      .session(options.session || null),
  ]);

  const outcome = evaluateControlSatisfaction(
    control,
    { policies, tests, evidence, risks },
    organization?.settings || {}
  );

  return {
    controlId: control._id,
    identifier: control.identifier,
    title: control.title,
    status: outcome.status,
    satisfied: outcome.satisfied,
  };
};

/**
 * Get control counts by overallStatus for dashboard
 * @param {ObjectId} organizationId
 * @returns {Promise<Object>} Status counts
 */
internalControlSchema.statics.getStatusCounts = async function (organizationId) {
  const results = await this.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true }, isActive: { $ne: false } } },
    { $group: { _id: '$overallStatus', count: { $sum: 1 } } },
  ]);

  // Convert to object format
  const counts = {
    PASS: 0,
    FAIL: 0,
    WARNING: 0,
    NOT_APPLICABLE: 0,
    NOT_CONFIGURED: 0,
    total: 0,
  };

  results.forEach(({ _id, count }) => {
    if (_id && counts.hasOwnProperty(_id)) {
      counts[_id] = count;
    }
    counts.total += count;
  });

  return counts;
};

// =============================================================================
// STATIC METHODS - Framework Gap Analysis
// =============================================================================

/**
 * Get compliance gap analysis for a framework
 * Shows which requirements have no controls mapped
 * 
 * @param {ObjectId} organizationId
 * @param {ObjectId} frameworkId
 * @returns {Promise<Object>} Gap analysis report
 */
internalControlSchema.statics.getFrameworkGapAnalysis = async function (organizationId, frameworkId) {
  const Requirement = mongoose.model('Requirement');

  // Get all requirements for this framework
  const allRequirements = await Requirement.find({
    frameworkId,
    isActive: true,
  })
    .populate({ path: 'categoryId', select: 'code title' })
    .lean();

  // Get all active controls mapped to this framework
  const controls = await this.find({
    organizationId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    'linkedRequirements.frameworkId': frameworkId,
  }).lean();

  // Build map of requirement coverage
  const coverageMap = new Map();

  for (const control of controls) {
    for (const link of control.linkedRequirements) {
      if (link.frameworkId.equals(frameworkId)) {
        const reqId = link.requirementId.toString();

        if (!coverageMap.has(reqId)) {
          coverageMap.set(reqId, {
            requirementId: link.requirementId,
            controls: [],
            coverage: link.coverage,
          });
        }

        coverageMap.get(reqId).controls.push({
          controlId: control._id,
          identifier: control.identifier,
          title: control.title,
          overallStatus: control.overallStatus,
          coverage: link.coverage,
        });
      }
    }
  }

  // Identify gaps
  const gaps = [];
  const partial = [];
  const covered = [];

  for (const req of allRequirements) {
    const reqId = req._id.toString();
    const coverage = coverageMap.get(reqId);

    if (!coverage) {
      // No controls mapped
      gaps.push({
        requirementId: req._id,
        identifier: req.identifier,
        title: req.title,
        categoryId: req.categoryId?._id ?? req.categoryId,
        categoryCode: req.categoryId?.code,
        categoryTitle: req.categoryId?.title,
        status: 'GAP',
      });
    } else if (coverage.controls.some(c => c.coverage === 'PARTIAL')) {
      // At least one control has partial coverage
      partial.push({
        requirementId: req._id,
        identifier: req.identifier,
        title: req.title,
        categoryId: req.categoryId?._id ?? req.categoryId,
        categoryCode: req.categoryId?.code,
        categoryTitle: req.categoryId?.title,
        status: 'PARTIAL',
        controls: coverage.controls,
      });
    } else {
      // Fully covered
      covered.push({
        requirementId: req._id,
        identifier: req.identifier,
        title: req.title,
        categoryId: req.categoryId?._id ?? req.categoryId,
        categoryCode: req.categoryId?.code,
        categoryTitle: req.categoryId?.title,
        status: 'COVERED',
        controls: coverage.controls,
      });
    }
  }

  return {
    frameworkId,
    total: allRequirements.length,
    gaps: gaps.length,
    partial: partial.length,
    covered: covered.length,
    gapPercentage: Math.round((gaps.length / allRequirements.length) * 100),
    coveragePercentage: Math.round((covered.length / allRequirements.length) * 100),
    details: {
      gaps,
      partial,
      covered,
    },
  };
};

/**
 * Get framework readiness score
 * Includes control status in the calculation
 * 
 * @param {ObjectId} organizationId
 * @param {ObjectId} frameworkId
 * @returns {Promise<Object>} Readiness score
 */
internalControlSchema.statics.getFrameworkReadiness = async function (organizationId, frameworkId) {
  const gapAnalysis = await this.getFrameworkGapAnalysis(organizationId, frameworkId);

  // Get all active controls for this framework
  const controls = await this.find({
    organizationId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    'linkedRequirements.frameworkId': frameworkId,
  }).lean();

  // Count controls by status
  const statusCounts = {
    PASS: 0,
    FAIL: 0,
    WARNING: 0,
    NOT_APPLICABLE: 0,
    NOT_CONFIGURED: 0,
  };

  for (const control of controls) {
    const status = control.overallStatus || 'NOT_CONFIGURED';
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    }
  }

  // Calculate readiness score
  // Formula: (PASS controls / total requirements) * 100
  const passControls = statusCounts.PASS;
  const readinessScore = Math.round((passControls / gapAnalysis.total) * 100);

  // Calculate compliance score (includes partial coverage)
  // Formula: ((PASS + WARNING) / total requirements) * 100
  const complianceScore = Math.round(
    ((passControls + statusCounts.WARNING) / gapAnalysis.total) * 100
  );

  return {
    frameworkId,
    readinessScore, // Strict: only PASS controls
    complianceScore, // Lenient: PASS + WARNING controls
    gapPercentage: gapAnalysis.gapPercentage,
    coveragePercentage: gapAnalysis.coveragePercentage,
    totalRequirements: gapAnalysis.total,
    totalControls: controls.length,
    statusBreakdown: statusCounts,
    gaps: gapAnalysis.gaps,
    recommendation: getRecommendation(readinessScore, gapAnalysis.gapPercentage),
    controls,
  };
};

/**
 * Get readiness recommendation based on score
 */
function getRecommendation(readinessScore, gapPercentage) {
  if (gapPercentage > 20) {
    return {
      level: 'CRITICAL',
      message: 'Significant gaps in framework coverage. Map controls to requirements before audit.',
    };
  }

  if (readinessScore < 50) {
    return {
      level: 'HIGH',
      message: 'Many controls are failing. Focus on remediating failing controls.',
    };
  }

  if (readinessScore < 80) {
    return {
      level: 'MEDIUM',
      message: 'Good progress. Continue improving control effectiveness.',
    };
  }

  if (readinessScore < 95) {
    return {
      level: 'LOW',
      message: 'Nearly audit-ready. Address remaining issues.',
    };
  }

  return {
    level: 'READY',
    message: 'Framework is audit-ready.',
  };
}

// =============================================================================
// STATIC METHODS - Bulk Operations
// =============================================================================

/**
 * Bulk create controls from templates
 * @param {ObjectId} organizationId
 * @param {ObjectId} userId - User creating the controls
 * @param {Array} templateIds - Array of GlobalControlTemplate IDs
 * @returns {Promise<Object>} Summary of created controls
 */
internalControlSchema.statics.bulkCreateFromTemplates = async function (organizationId, userId, templateIds) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const GlobalControlTemplate = mongoose.model('GlobalControlTemplate');
    const GlobalTestTemplate = mongoose.model('GlobalTestTemplate');
    const Test = mongoose.model('Test');
    const Evidence = mongoose.model('Evidence');
    const ActivityLog = mongoose.model('ActivityLog');

    const templates = await GlobalControlTemplate.find({
      _id: { $in: templateIds },
      isActive: true,
    }).session(session);

    if (templates.length === 0) {
      throw new Error('No valid templates found');
    }

    // Check for existing identifiers
    const templateIdentifiers = templates.map(t => t.identifier);
    const existingControls = await this.find({
      organizationId,
      identifier: { $in: templateIdentifiers },
      isDeleted: false,
    }).session(session).select('identifier');

    if (existingControls.length > 0) {
      const duplicates = existingControls.map(c => c.identifier).join(', ');
      throw new Error(`Controls with these identifiers already exist: ${duplicates}`);
    }

    // FIX Bug 6: Resolve suggestedRequirements {frameworkCode, identifier} strings to
    // real ObjectIds. The old code passed template.suggestedRequirements directly to
    // linkedRequirements which expects {requirementId: ObjectId, frameworkId: ObjectId}.
    // Mongoose silently dropped the unknown fields, leaving null ObjectIds so the UI
    // could never query controls by requirementId.
    const Framework = mongoose.model('Framework');
    const Requirement = mongoose.model('Requirement');

    const allFrameworkCodes = [
      ...new Set(templates.flatMap(t => (t.suggestedRequirements || []).map(sr => sr.frameworkCode).filter(Boolean))),
    ];
    const frameworkDocs = await Framework.find({ code: { $in: allFrameworkCodes } }).session(session).lean();
    const frameworkByCode = new Map(frameworkDocs.map(f => [f.code, f._id]));

    const allRequirements = await Requirement.find({
      frameworkId: { $in: frameworkDocs.map(f => f._id) },
    }).session(session).lean();
    const requirementLookup = new Map();
    for (const req of allRequirements) {
      const fw = frameworkDocs.find(f => f._id.toString() === req.frameworkId?.toString());
      if (fw) requirementLookup.set(`${fw.code}:${req.identifier}`, { reqId: req._id, fwId: fw._id });
    }

    const controlsToCreate = templates.map(template => ({
      organizationId,
      sourceTemplateId: template._id,
      identifier: template.identifier,
      title: template.title,
      description: template.description,
      controlGroup: template.controlGroup,
      suggestedPolicySlugs: template.suggestedPolicySlugs || [],
      manualStatus: template.defaultManualStatus,
      frequency: template.frequency,
      linkedRequirements: (template.suggestedRequirements || []).flatMap(sr => {
        const mapped = requirementLookup.get(`${sr.frameworkCode}:${sr.identifier}`);
        if (!mapped) return [];
        return [{ requirementId: mapped.reqId, frameworkId: mapped.fwId, coverage: sr.coverage || 'FULL' }];
      }),
      implementationNotes: template.implementationGuidance,
    }));

    const created = await this.insertMany(controlsToCreate, { session });

    // Provision Tests (automated) and Evidence (document) from global test templates.
    const controlByIdentifier = new Map(created.map(c => [c.identifier, c._id]));
    const controlTemplateIdentifiers = templates.map(t => t.identifier);
    const testTemplates = await GlobalTestTemplate.find({
      isActive: true,
      suggestedControlIdentifiers: { $in: controlTemplateIdentifiers },
    }).session(session);

    const existingTests = await Test.find({
      organizationId,
      name: { $in: testTemplates.filter(tt => tt.type === 'automated').map(tt => tt.name) },
      isDeleted: false,
    }).session(session).select('name');
    const existingTestNames = new Set(existingTests.map(t => t.name.toLowerCase().trim()));

    const existingEvidence = await Evidence.find({
      organizationId,
      title: { $in: testTemplates.filter(tt => tt.type === 'document').map(tt => tt.name) },
      isDeleted: false,
    }).session(session).select('title');
    const existingEvidenceTitles = new Set(existingEvidence.map(e => e.title.toLowerCase().trim()));

    const testsToCreate = [];
    const evidenceToCreate = [];

    for (const tt of testTemplates) {
      const normalizedName = tt.name.toLowerCase().trim();

      const linkedControlIds = (tt.suggestedControlIdentifiers || [])
        .filter(identifier => controlByIdentifier.has(identifier))
        .map(identifier => controlByIdentifier.get(identifier));

      if (linkedControlIds.length === 0) continue;

      if (tt.type === 'automated') {
        if (existingTestNames.has(normalizedName)) continue;
        testsToCreate.push({
          organizationId,
          notionId: `global-template:${normalizedName}`,
          name: tt.name,
          description: tt.description || '',
          evidenceGuidance: tt.evidenceGuidance || '',
          type: 'automated',
          category: tt.category || 'Engineering',
          renewalPeriod: tt.renewalPeriod,
          rollout: 'enabled',
          linkedControlIds,
          isActive: true,
        });
      } else if (tt.type === 'document') {
        if (existingEvidenceTitles.has(normalizedName)) continue;
        evidenceToCreate.push({
          organizationId,
          title: tt.name,
          description: tt.evidenceGuidance || tt.description || '',
          category: tt.category || 'Engineering',
          linkedControlIds,
          uploadedBy: userId,
          status: 'PENDING',
        });
      }
    }

    const createdTests = testsToCreate.length > 0
      ? await Test.insertMany(testsToCreate, { session })
      : [];

    const createdEvidence = evidenceToCreate.length > 0
      ? await Evidence.insertMany(evidenceToCreate, { session })
      : [];

    // Bulk log activity
    await ActivityLog.insertMany(
      created.map(control => ({
        organizationId,
        actorId: userId,
        action: 'CREATE',
        entityType: 'InternalControl',
        entityId: control._id,
        entitySnapshot: {
          title: control.title,
          identifier: control.identifier,
        },
        timestamp: new Date(),
        notes: 'Created from template',
      })),
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      created: created.length,
      testsCreated: createdTests.length,
      evidenceCreated: createdEvidence.length,
      controls: created,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Bulk update control statuses
 * @param {Array} updates - Array of { controlId, manualStatus?, automationStatus? }
 * @param {ObjectId} userId - User performing the update
 * @returns {Promise<Object>} Update summary
 */
internalControlSchema.statics.bulkUpdateStatuses = async function (updates, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ActivityLog = mongoose.model('ActivityLog');
    const results = {
      updated: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        const control = await this.findById(update.controlId).session(session);

        if (!control) {
          results.errors.push({
            controlId: update.controlId,
            error: 'Control not found',
          });
          continue;
        }

        const changes = { fields: [] };
        const before = {};
        const after = {};

        if (update.manualStatus !== undefined) {
          before.manualStatus = control.manualStatus;
          control.manualStatus = update.manualStatus;
          after.manualStatus = update.manualStatus;
          changes.fields.push('manualStatus');
        }

        if (update.automationStatus !== undefined) {
          before.automationStatus = control.automationStatus;
          control.automationStatus = update.automationStatus;
          after.automationStatus = update.automationStatus;
          changes.fields.push('automationStatus');
        }

        await control.save({ session });

        // Log activity
        await ActivityLog.create([{
          organizationId: control.organizationId,
          actorId: userId,
          action: 'STATUS_CHANGE',
          entityType: 'InternalControl',
          entityId: control._id,
          entitySnapshot: {
            title: control.title,
            identifier: control.identifier,
          },
          changes: {
            before,
            after,
            fields: changes.fields,
          },
          timestamp: new Date(),
        }], { session });

        results.updated++;
      } catch (error) {
        results.errors.push({
          controlId: update.controlId,
          error: error.message,
        });
      }
    }

    await session.commitTransaction();
    return results;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// =============================================================================
// INSTANCE METHODS - Authorization
// =============================================================================

/**
 * Check if user can modify this control
 * @param {Object} user - Authenticated user with { _id, organizationId, role }
 * @returns {Boolean}
 */
internalControlSchema.methods.canModify = function (user) {
  if (!user) return false;

  // Check organization membership
  if (this.organizationId && !this.organizationId.equals(user.organizationId)) {
    return false;
  }

  // Auditors have read-only access
  if (user.role === 'AUDITOR') {
    return false;
  }

  // ADMIN and MANAGER can modify anything in their org
  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return true;
  }

  // EMPLOYEE can only modify if they're the owner
  if (this.ownerId && user._id) {
    return this.ownerId.equals(user._id);
  }

  return false;
};

/**
 * Check if user can delete this control
 * @param {Object} user - Authenticated user
 * @returns {Boolean}
 */
internalControlSchema.methods.canDelete = function (user) {
  if (!user) return false;

  // Only ADMIN can delete
  if (user.role !== 'ADMIN') {
    return false;
  }

  // Check organization membership
  if (this.organizationId && !this.organizationId.equals(user.organizationId)) {
    return false;
  }

  return true;
};

// =============================================================================
// INDEXES
// =============================================================================

internalControlSchema.index({ organizationId: 1, isDeleted: 1 });
internalControlSchema.index({ organizationId: 1, isActive: 1 });
// Partial unique index - allows reusing identifiers after soft deletion
internalControlSchema.index(
  { organizationId: 1, identifier: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
internalControlSchema.index({ organizationId: 1, 'linkedRequirements.frameworkId': 1 });
internalControlSchema.index({ organizationId: 1, ownerId: 1 });
internalControlSchema.index({ organizationId: 1, manualStatus: 1 });
internalControlSchema.index({ organizationId: 1, automationStatus: 1 });
// Index for dashboard sorting by overallStatus
internalControlSchema.index({ organizationId: 1, overallStatus: 1 });
internalControlSchema.index({ organizationId: 1, isDeleted: 1, overallStatus: 1 });
internalControlSchema.index({ organizationId: 1, controlGroup: 1 });
internalControlSchema.index({ nextAssessmentDue: 1 });
// Compound index for framework-specific queries
internalControlSchema.index({
  organizationId: 1,
  'linkedRequirements.frameworkId': 1,
  'linkedRequirements.coverage': 1,
  overallStatus: 1,
});

// Enable virtuals in JSON
internalControlSchema.set('toJSON', { virtuals: true });
internalControlSchema.set('toObject', { virtuals: true });

// =============================================================================
// PLUGINS
// =============================================================================

// Apply tenant plugin for soft delete support
internalControlSchema.plugin(tenantPlugin);
internalControlSchema.plugin(applyOrgScope, 'organizationId');

// Apply enhanced soft delete with cascade
internalControlSchema.plugin(enhancedSoftDelete, {
  removeReferences: [
    { model: 'Evidence', field: 'linkedControlIds' },
    { model: 'Risk', field: 'mitigatingControlIds' },
    { model: 'Policy', field: 'linkedControlIds' },
    { model: 'Vendor', field: 'linkedControlIds' },
  ],
});

const InternalControl = mongoose.model('InternalControl', internalControlSchema);

export default InternalControl;
