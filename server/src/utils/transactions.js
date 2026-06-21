/**
 * Transaction Helpers for Multi-Step Operations
 * 
 * Create this as utils/transactions.js
 */

import mongoose from 'mongoose';

/**
 * Generic transaction wrapper
 * Handles session creation, commit, and rollback
 * 
 * @param {Function} operation - Async function that receives session
 * @returns {Promise<any>} Result of the operation
 */
export async function withTransaction(operation) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// =============================================================================
// POLICY OPERATIONS (require atomicity)
// =============================================================================

/**
 * Publish a policy version (atomic operation)
 * 
 * Steps:
 * 1. Update old version status to ARCHIVED
 * 2. Update new version status to ACTIVE
 * 3. Update Policy.currentVersionId
 * 4. Update Policy.status to ACTIVE
 * 5. Log activity
 * 
 * @param {ObjectId} policyId
 * @param {ObjectId} versionId
 * @param {ObjectId} userId
 * @returns {Promise<Object>} Updated policy and version
 */
export async function publishPolicyVersion(policyId, versionId, userId) {
  return withTransaction(async (session) => {
    const Policy = mongoose.model('Policy');
    const PolicyVersion = mongoose.model('PolicyVersion');
    const ActivityLog = mongoose.model('ActivityLog');

    // 1. Get policy and version
    const policy = await Policy.findById(policyId).session(session);
    if (!policy) {
      throw new Error('Policy not found');
    }

    const newVersion = await PolicyVersion.findById(versionId).session(session);
    if (!newVersion || !newVersion.policyId.equals(policyId)) {
      throw new Error('Policy version not found or does not belong to this policy');
    }

    // 2. Archive old version if exists
    if (policy.currentVersionId) {
      await PolicyVersion.findByIdAndUpdate(
        policy.currentVersionId,
        {
          status: 'ARCHIVED',
          supersededAt: new Date(),
          supersededBy: versionId,
        },
        { session }
      );
    }

    // 3. Activate new version
    await PolicyVersion.findByIdAndUpdate(
      versionId,
      {
        status: 'ACTIVE',
        effectiveDate: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
      },
      { session }
    );

    // 4. Update policy
    await Policy.findByIdAndUpdate(
      policyId,
      {
        currentVersionId: versionId,
        status: 'ACTIVE',
      },
      { session }
    );

    // 5. Log activity
    await ActivityLog.create([{
      organizationId: policy.organizationId,
      actorId: userId,
      action: 'UPDATE',
      entityType: 'Policy',
      entityId: policyId,
      entitySnapshot: {
        title: policy.title,
      },
      changes: {
        fields: ['currentVersionId', 'status'],
        after: {
          currentVersionId: versionId,
          status: 'ACTIVE',
        },
      },
      timestamp: new Date(),
      notes: `Published version ${newVersion.versionNumber}`,
    }], { session });

    // Return updated documents
    const updatedPolicy = await Policy.findById(policyId).session(session);
    const updatedVersion = await PolicyVersion.findById(versionId).session(session);

    return { policy: updatedPolicy, version: updatedVersion };
  });
}

// =============================================================================
// AUDIT OPERATIONS (require atomicity)
// =============================================================================

/**
 * Create audit snapshot for a control
 * 
 * Steps:
 * 1. Fetch control with all related data
 * 2. Fetch linked evidence
 * 3. Fetch linked requirements
 * 4. Create immutable snapshot
 * 5. Log activity
 * 
 * @param {ObjectId} auditId
 * @param {ObjectId} controlId
 * @param {ObjectId} userId
 * @returns {Promise<Document>} Created snapshot
 */
export async function createAuditSnapshot(auditId, controlId, userId) {
  const { snapshot, activity } = await withTransaction(async (session) => {
    const InternalControl = mongoose.model('InternalControl');
    const Evidence = mongoose.model('Evidence');
    const Requirement = mongoose.model('Requirement');
    const AuditControlSnapshot = mongoose.model('AuditControlSnapshot');

    // 1. Fetch control
    const control = await InternalControl.findById(controlId)
      .populate('ownerId', 'firstName lastName email')
      .session(session);

    if (!control) {
      throw new Error('Control not found');
    }

    // 2. Fetch linked evidence
    const evidence = await Evidence.find({
      linkedControlIds: controlId,
      isDeleted: { $ne: true },
    }).session(session);

    // 3. Fetch linked requirements
    const requirementIds = control.linkedRequirements.map(r => r.requirementId);
    const requirements = await Requirement.find({
      _id: { $in: requirementIds },
    }).populate('frameworkId', 'code name').session(session);

    // Build requirement map
    const requirementMap = new Map();
    requirements.forEach(req => {
      requirementMap.set(req._id.toString(), req);
    });

    // 4. Create snapshot
    const snapshot = await AuditControlSnapshot.create([{
      auditId,
      originalControlId: control._id,
      controlIdentifier: control.identifier,
      controlTitle: control.title,
      controlDescription: control.description,
      controlCategory: control.controlGroup,
      manualStatusAtSnapshot: control.manualStatus,
      automationStatusAtSnapshot: control.automationStatus,
      overallStatusAtSnapshot: control.overallStatus,
      ownerAtSnapshot: control.ownerId ? {
        userId: control.ownerId._id,
        name: control.ownerId.fullName,
        email: control.ownerId.email,
      } : null,
      linkedRequirementsAtSnapshot: control.linkedRequirements.map(link => {
        const req = requirementMap.get(link.requirementId.toString());
        return {
          requirementId: link.requirementId,
          frameworkId: link.frameworkId,
          frameworkCode: req?.frameworkId?.code,
          requirementIdentifier: req?.identifier,
          coverage: link.coverage,
          justification: link.justification,
        };
      }),
      evidenceSnapshots: evidence.map(ev => ({
        originalEvidenceId: ev._id,
        title: ev.title,
        fileUrl: ev.fileUrl,
        fileName: ev.fileName,
        validFrom: ev.validFrom,
        validUntil: ev.validUntil,
        status: ev.status,
      })),
      snapshottedAt: new Date(),
      snapshottedBy: userId,
    }], { session });

    return {
      snapshot: snapshot[0],
      activity: {
        organizationId: control.organizationId,
        actorId: userId,
        action: 'CREATE',
        entityType: 'AuditControlSnapshot',
        entityId: snapshot[0]._id,
        entitySnapshot: {
          title: control.title,
          identifier: control.identifier,
        },
        timestamp: new Date(),
        notes: `Created audit snapshot for control ${control.identifier}`,
      },
    };
  });

  // MongoDB time-series collections cannot be written inside multi-document
  // transactions. Keep the snapshot transaction clean and append the audit log
  // afterward; logging failure should not invalidate the immutable snapshot.
  try {
    const ActivityLog = mongoose.model('ActivityLog');
    await ActivityLog.create(activity);
  } catch (error) {
    console.error('[AuditSnapshot] Failed to write activity log:', error.message);
  }

  return snapshot;
}

/**
 * Bulk create audit snapshots for all controls in an audit
 * 
 * @param {ObjectId} auditId
 * @param {ObjectId} organizationId
 * @param {ObjectId} userId
 * @param {Object} options - { frameworkId }
 * @returns {Promise<Object>} Summary of created snapshots
 */
export async function createBulkAuditSnapshots(auditId, organizationId, userId, options = {}) {
  const { frameworkId } = options;
  const InternalControl = mongoose.model('InternalControl');

  // Build query
  const query = {
    organizationId,
    isDeleted: { $ne: true },
  };

  if (frameworkId) {
    query['linkedRequirements.frameworkId'] = frameworkId;
  }

  // Fetch all controls
  const controls = await InternalControl.find(query).select('_id');

  const results = {
    total: controls.length,
    created: 0,
    errors: [],
  };

  // Create snapshots sequentially (to avoid overwhelming DB)
  for (const control of controls) {
    try {
      await createAuditSnapshot(auditId, control._id, userId);
      results.created++;
    } catch (error) {
      results.errors.push({
        controlId: control._id,
        error: error.message,
      });
    }
  }

  return results;
}

// =============================================================================
// CONTROL STATUS UPDATE (with automation findings)
// =============================================================================

/**
 * Update control automation status from integration findings
 * 
 * Steps:
 * 1. Create AutomationFinding record
 * 2. Update InternalControl.automationStatus
 * 3. Recalculate overallStatus
 * 4. Update linked risks' residual scores
 * 5. Log activity
 * 
 * @param {Object} findingData - Automation finding data
 * @returns {Promise<Object>} Updated control and finding
 */
export async function updateControlFromAutomation(findingData) {
  return withTransaction(async (session) => {
    const InternalControl = mongoose.model('InternalControl');
    const AutomationFinding = mongoose.model('AutomationFinding');
    const Risk = mongoose.model('Risk');
    const ActivityLog = mongoose.model('ActivityLog');

    const {
      organizationId,
      controlId,
      source,
      externalId,
      title,
      description,
      status, // PASS, FAIL, WARNING
      severity,
      resourceType,
      resourceId,
      resourceName,
      rawData,
      runId,
    } = findingData;

    // 1. Create finding
    const finding = await AutomationFinding.create([{
      organizationId,
      controlId,
      source,
      externalId,
      title,
      description,
      status,
      severity,
      resourceType,
      resourceId,
      resourceName,
      rawData,
      detectedAt: new Date(),
      runId,
    }], { session });

    // 2. Update control status
    const control = await InternalControl.findById(controlId).session(session);
    if (!control) {
      throw new Error('Control not found');
    }

    const oldAutomationStatus = control.automationStatus;

    // Map finding status to automation status
    control.automationStatus = status;
    control.automationConfig = control.automationConfig || {};
    control.automationConfig.lastRunAt = new Date();

    await control.save({ session });

    // 3. Update linked risks
    if (control.linkedRiskIds && control.linkedRiskIds.length > 0) {
      const risks = await Risk.find({
        _id: { $in: control.linkedRiskIds },
        isDeleted: { $ne: true },
      }).session(session);

      for (const risk of risks) {
        await risk.calculateResidualScore(session);
      }
    }

    // 4. Log activity
    await ActivityLog.create([{
      organizationId,
      actorId: null, // System action
      actorSnapshot: {
        email: 'system@automation',
        name: 'Automation Engine',
        role: 'SYSTEM',
      },
      action: 'STATUS_CHANGE',
      entityType: 'InternalControl',
      entityId: controlId,
      entitySnapshot: {
        title: control.title,
        identifier: control.identifier,
      },
      changes: {
        before: { automationStatus: oldAutomationStatus },
        after: { automationStatus: status },
        fields: ['automationStatus', 'overallStatus'],
      },
      timestamp: new Date(),
      metadata: {
        source,
        externalId,
        runId,
      },
      notes: `Automation finding: ${title}`,
    }], { session });

    return {
      control: await InternalControl.findById(controlId).session(session),
      finding: finding[0],
    };
  });
}

// =============================================================================
// ORGANIZATION CASCADE DELETE
// =============================================================================

/**
 * Cascade soft delete an entire organization (admin operation)
 * 
 * Steps:
 * 1. Soft delete all users
 * 2. Soft delete all controls
 * 3. Soft delete all policies
 * 4. Soft delete all evidence
 * 5. Soft delete all risks
 * 6. Soft delete all vendors
 * 7. Mark organization as deleted
 * 8. Log activity
 * 
 * @param {ObjectId} organizationId
 * @param {ObjectId} adminUserId
 * @returns {Promise<Object>} Deletion summary
 */
export async function cascadeDeleteOrganization(organizationId, adminUserId) {
  return withTransaction(async (session) => {
    const Organization = mongoose.model('Organization');
    const User = mongoose.model('User');
    const InternalControl = mongoose.model('InternalControl');
    const Policy = mongoose.model('Policy');
    const Evidence = mongoose.model('Evidence');
    const Risk = mongoose.model('Risk');
    const Vendor = mongoose.model('Vendor');
    const ActivityLog = mongoose.model('ActivityLog');

    const summary = {
      organizationId,
      deleted: {},
    };

    // Soft delete all tenant entities
    const models = [
      { name: 'User', Model: User },
      { name: 'InternalControl', Model: InternalControl },
      { name: 'Policy', Model: Policy },
      { name: 'Evidence', Model: Evidence },
      { name: 'Risk', Model: Risk },
      { name: 'Vendor', Model: Vendor },
    ];

    for (const { name, Model } of models) {
      const result = await Model.updateMany(
        {
          organizationId,
          isDeleted: { $ne: true },
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: adminUserId,
        },
        { session }
      );

      summary.deleted[name] = result.modifiedCount;
    }

    // Mark organization as deleted (assuming Organization has soft delete)
    await Organization.findByIdAndUpdate(
      organizationId,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminUserId,
      },
      { session }
    );

    // Log activity
    await ActivityLog.create([{
      organizationId,
      actorId: adminUserId,
      action: 'DELETE',
      entityType: 'Organization',
      entityId: organizationId,
      timestamp: new Date(),
      notes: 'Organization cascade deleted',
    }], { session });

    return summary;
  });
}

/**
 * Example Usage:
 * 
 * // In your service/controller:
 * import { publishPolicyVersion, createAuditSnapshot } from '../utils/transactions.js';
 * 
 * // Publish policy
 * const result = await publishPolicyVersion(policyId, versionId, req.user._id);
 * 
 * // Create audit snapshot
 * const snapshot = await createAuditSnapshot(auditId, controlId, req.user._id);
 */
