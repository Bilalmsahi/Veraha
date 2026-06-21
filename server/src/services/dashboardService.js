/**
 * Dashboard Service
 * Business logic for dashboard aggregations and summaries.
 * Combines data from multiple models for dashboard views.
 */

import mongoose from 'mongoose';
import InternalControl from '../models/InternalControl.js';
import Organization from '../models/Organization.js';
import Framework from '../models/Framework.js';
import ActivityLog from '../models/ActivityLog.js';
import Evidence from '../models/Evidence.js';
import Policy from '../models/Policy.js';
import Test from '../models/Test.js';
import Vendor from '../models/Vendor.js';
import readinessService from './readinessService.js';
import { getGrantedFrameworkIdSet } from './frameworkAccessService.js';

/**
 * Get overall compliance summary
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Summary data
 */
export const getSummary = async (orgId) => {
  // Get organization with enabled frameworks
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  }).populate('settings.enabledFrameworks', 'code name');

  if (!org) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  // Get control status counts
  const controlCounts = await InternalControl.getStatusCounts(orgId);

  // Calculate overall score (PASS / (total - NOT_APPLICABLE - NOT_CONFIGURED) * 100)
  const assessedControls = controlCounts.total - controlCounts.NOT_APPLICABLE - controlCounts.NOT_CONFIGURED;
  const overallScore = assessedControls > 0
    ? Math.round((controlCounts.PASS / assessedControls) * 100)
    : 0;

  const [allFrameworks, grantedFrameworkIds] = await Promise.all([
    Framework.find({ isActive: true }).select('code name version').sort({ code: 1 }).lean(),
    getGrantedFrameworkIdSet(orgId),
  ]);

  // Get framework readiness for every framework. Access flags only affect UI
  // visibility; readiness is calculated from the complete seeded backend state.
  const frameworkReadiness = [];
  for (const framework of allFrameworks) {
    try {
      const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
        orgId,
        framework.code
      );
      frameworkReadiness.push({
        code: framework.code,
        name: framework.name,
        readinessScore: readiness.readinessScore,
        complianceScore: readiness.complianceScore,
        gaps: readiness.gaps,
        passingRequirements: readiness.rollup?.requirement?.pass ?? readiness.covered ?? 0,
        totalRequirements: readiness.totalRequirements,
        ready: readiness.rollup?.framework?.ready ?? false,
        isPurchased: grantedFrameworkIds.has(framework._id.toString()),
        isAccessible: grantedFrameworkIds.has(framework._id.toString()),
      });
    } catch (err) {
      // Skip frameworks with errors
      console.error(`Failed to get readiness for ${framework.code}:`, err.message);
    }
  }

  // Get alerts
  const alerts = await getAlerts(orgId);
  const monitoring = await getMonitoringStats(orgId);

  return {
    organization: {
      name: org.name,
      setupComplete: org.setupComplete,
      subscriptionTier: org.subscriptionTier,
    },
    overallScore,
    controlCounts,
    frameworkReadiness,
    monitoring,
    alerts: {
      expiringEvidence: alerts.expiringEvidence.length,
      overdueAssessments: alerts.overdueAssessments.length,
      failingControls: controlCounts.FAIL,
      warningControls: controlCounts.WARNING,
    },
  };
};

const summarize = (items, needsAttentionFn) => {
  const total = items.length;
  const needsAttention = items.filter(needsAttentionFn).length;
  return {
    needsAttention,
    ok: Math.max(total - needsAttention, 0),
    total,
  };
};

/**
 * Get monitoring counters for dashboard cards.
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Monitoring card counts
 */
export const getMonitoringStats = async (orgId) => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [policies, tests, vendors, documents] = await Promise.all([
    Policy.find({
      organizationId: orgId,
      isDeleted: false,
      status: { $ne: 'ARCHIVED' },
      archivedAt: null,
    })
      .select('status requiresAttestation acknowledgementRate nextReviewDue')
      .lean(),
    Test.find({
      organizationId: orgId,
      isDeleted: false,
      isActive: true,
      archivedAt: null,
      notApplicableAt: null,
      $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
    })
      .select('status')
      .lean(),
    Vendor.find({
      organizationId: orgId,
      isDeleted: false,
      status: 'ACTIVE',
    })
      .select('riskTier nextAssessmentDate')
      .lean(),
    Evidence.find({
      organizationId: orgId,
      isDeleted: false,
      archivedAt: null,
    })
      .select('status validUntil')
      .lean(),
  ]);

  return {
    policies: summarize(
      policies,
      (policy) =>
        policy.status !== 'ACTIVE' ||
        Boolean(policy.nextReviewDue && new Date(policy.nextReviewDue) < now) ||
        Boolean(policy.requiresAttestation && (policy.acknowledgementRate ?? 0) < 100)
    ),
    tests: summarize(
      tests,
      (test) => !['ok', 'na'].includes(test.status)
    ),
    vendors: summarize(
      vendors,
      (vendor) => {
        const isHighOrCritical = ['CRITICAL', 'HIGH'].includes(vendor.riskTier);
        const isPastDue = Boolean(
          vendor.nextAssessmentDate && new Date(vendor.nextAssessmentDate) < now
        );
        return (isHighOrCritical && !vendor.nextAssessmentDate) || isPastDue;
      }
    ),
    documents: summarize(
      documents,
      (document) =>
        document.status !== 'APPROVED' ||
        Boolean(document.validUntil && new Date(document.validUntil) <= thirtyDaysFromNow)
    ),
  };
};

/**
 * Get per-framework readiness details
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Array>} Framework readiness array
 */
export const getFrameworksReadiness = async (orgId) => {
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  }).select('_id');

  if (!org) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  const [allFrameworks, grantedFrameworkIds] = await Promise.all([
    Framework.find({ isActive: true }).select('code name version').sort({ code: 1 }).lean(),
    getGrantedFrameworkIdSet(orgId),
  ]);

  const frameworks = [];

  for (const framework of allFrameworks) {
    try {
      const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
        orgId,
        framework.code
      );

      frameworks.push({
        _id: framework._id,
        code: framework.code,
        name: framework.name,
        version: framework.version,
        readinessScore: readiness.readinessScore,
        complianceScore: readiness.complianceScore,
        coveragePercentage: readiness.coveragePercentage,
        gapPercentage: readiness.gapPercentage,
        totalRequirements: readiness.totalRequirements,
        gaps: readiness.gaps,
        partial: readiness.partial,
        covered: readiness.covered,
        statusBreakdown: readiness.statusBreakdown,
        recommendation: readiness.recommendation,
        ready: readiness.rollup?.framework?.ready ?? false,
        isPurchased: grantedFrameworkIds.has(framework._id.toString()),
        isAccessible: grantedFrameworkIds.has(framework._id.toString()),
      });
    } catch (err) {
      console.error(`Failed to get readiness for ${framework.code}:`, err.message);
    }
  }

  return frameworks;
};

/**
 * Get recent activity feed
 * @param {String} orgId - Organization ObjectId
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} { activities, pagination }
 */
export const getActivity = async (orgId, options = {}) => {
  const { page = 1, limit = 20 } = options;

  const query = { organizationId: orgId };

  const total = await ActivityLog.countDocuments(query);

  const activities = await ActivityLog.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('actorId', 'firstName lastName email')
    .lean();

  // Transform for cleaner response
  const transformedActivities = activities.map(a => ({
    _id: a._id,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    entitySnapshot: a.entitySnapshot,
    actor: a.actorId ? {
      _id: a.actorId._id,
      name: `${a.actorId.firstName} ${a.actorId.lastName}`,
      email: a.actorId.email,
    } : a.actorSnapshot,
    timestamp: a.timestamp,
    notes: a.notes,
    metadata: a.metadata,
  }));

  const pages = Math.ceil(total / limit);

  return {
    activities: transformedActivities,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get alerts (expiring evidence, overdue assessments, failing controls)
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Alerts data
 */
export const getAlerts = async (orgId) => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Get expiring evidence (validUntil within 30 days)
  let expiringEvidence = [];
  try {
    expiringEvidence = await Evidence.find({
      organizationId: orgId,
      isDeleted: false,
      archivedAt: null,
      validUntil: { $gte: now, $lte: thirtyDaysFromNow },
    })
      .select('title validUntil linkedControlIds')
      .populate('linkedControlIds', 'identifier title')
      .sort({ validUntil: 1 })
      .limit(20)
      .lean();
  } catch (err) {
    // Evidence model might not have data yet
    console.error('Failed to get expiring evidence:', err.message);
  }

  // Get overdue assessments (nextAssessmentDue in the past) - active controls only
  const overdueAssessments = await InternalControl.find({
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
    nextAssessmentDue: { $lt: now },
  })
    .select('identifier title nextAssessmentDue lastAssessedAt overallStatus')
    .sort({ nextAssessmentDue: 1 })
    .limit(20)
    .lean();

  // Get failing controls (active only)
  const failingControls = await InternalControl.find({
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
    overallStatus: 'FAIL',
  })
    .select('identifier title controlGroup lastAssessedAt')
    .sort({ lastAssessedAt: -1 })
    .limit(20)
    .lean();

  // Get warning controls (active only)
  const warningControls = await InternalControl.find({
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
    overallStatus: 'WARNING',
  })
    .select('identifier title controlGroup lastAssessedAt')
    .sort({ lastAssessedAt: -1 })
    .limit(20)
    .lean();

  // Get controls never assessed (active only)
  const neverAssessed = await InternalControl.find({
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
    lastAssessedAt: null,
    overallStatus: { $in: ['NOT_APPLICABLE', 'NOT_CONFIGURED'] },
  })
    .select('identifier title controlGroup createdAt')
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  return {
    expiringEvidence: expiringEvidence.map(e => ({
      _id: e._id,
      title: e.title,
      validUntil: e.validUntil,
      daysUntilExpiry: Math.ceil((new Date(e.validUntil) - now) / (24 * 60 * 60 * 1000)),
      linkedControls: e.linkedControlIds,
    })),
    overdueAssessments: overdueAssessments.map(c => ({
      _id: c._id,
      identifier: c.identifier,
      title: c.title,
      nextAssessmentDue: c.nextAssessmentDue,
      lastAssessedAt: c.lastAssessedAt,
      daysOverdue: Math.ceil((now - new Date(c.nextAssessmentDue)) / (24 * 60 * 60 * 1000)),
      overallStatus: c.overallStatus,
    })),
    failingControls,
    warningControls,
    neverAssessed: neverAssessed.map(c => ({
      _id: c._id,
      identifier: c.identifier,
      title: c.title,
      controlGroup: c.controlGroup,
      daysSinceCreation: Math.ceil((now - new Date(c.createdAt)) / (24 * 60 * 60 * 1000)),
    })),
  };
};

/**
 * Get quick stats for header/navbar
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Quick stats
 */
export const getQuickStats = async (orgId) => {
  const controlCounts = await InternalControl.getStatusCounts(orgId);
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  }).populate('settings.enabledFrameworks', 'code name');

  let frameworkScores = [];
  for (const framework of org?.settings?.enabledFrameworks || []) {
    try {
      const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
        orgId,
        framework.code
      );
      frameworkScores.push(readiness.readinessScore);
    } catch (err) {
      console.error(`Failed to get readiness for ${framework.code}:`, err.message);
    }
  }

  // Fall back to control status counts if the organization has no enabled frameworks.
  const assessedControls = controlCounts.total - controlCounts.NOT_APPLICABLE - controlCounts.NOT_CONFIGURED;
  const compliancePercentage = frameworkScores.length
    ? Math.round(frameworkScores.reduce((sum, score) => sum + score, 0) / frameworkScores.length)
    : assessedControls > 0
      ? Math.round((controlCounts.PASS / assessedControls) * 100)
      : 0;

  return {
    totalControls: controlCounts.total,
    passingControls: controlCounts.PASS,
    failingControls: controlCounts.FAIL,
    warningControls: controlCounts.WARNING,
    compliancePercentage,
  };
};

export default {
  getSummary,
  getFrameworksReadiness,
  getActivity,
  getAlerts,
  getMonitoringStats,
  getQuickStats,
};
