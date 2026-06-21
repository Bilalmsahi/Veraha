/**
 * HR Integration Service
 * Business logic for HR profile import, departure, and control linking
 */
import HrProfile from '../models/HrProfile.js';
import User from '../models/User.js';
import PolicyAttestation from '../models/PolicyAttestation.js';
import PolicyVersion from '../models/PolicyVersion.js';
import Evidence from '../models/Evidence.js';
import OffboardingEvent from '../models/OffboardingEvent.js';
import emailService from './emailService.js';
import { createCompanionEvidence } from './awsIntegration.service.js';

const normaliseEmail = (email) => email?.toLowerCase()?.trim() ?? '';

const findProfileOrThrow = async (organizationId, profileId) => {
  const profile = await HrProfile.findOne({
    _id: profileId,
    organizationId,
    isDeleted: false,
  });

  if (!profile) {
    const error = new Error('HR profile not found');
    error.statusCode = 404;
    throw error;
  }

  return profile;
};

/**
 * Upsert an HR profile by organisation and work email
 */
export const upsertProfile = async (organizationId, importingUserId, data) => {
  const normalisedEmail = normaliseEmail(data.workEmail);

  const user = await User.findOne({
    organizationId,
    email: normalisedEmail,
    isDeleted: false,
  });

  const updateData = {
    ...data,
    workEmail: normalisedEmail,
    userId: user ? user._id : null,
    lastImportedAt: new Date(),
  };

  const existing = await HrProfile.findOne({
    organizationId,
    workEmail: normalisedEmail,
  });

  const profile = await HrProfile.findOneAndUpdate(
    { organizationId, workEmail: normalisedEmail },
    {
      $set: updateData,
      $setOnInsert: { createdBy: importingUserId },
    },
    { upsert: true, new: true }
  );

  return { profile, created: !existing };
};

/**
 * Import HR profiles from parsed CSV rows
 */
export const importFromCSV = async (organizationId, importingUserId, rows, hrSource) => {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  const seenEmails = new Set();

  for (const row of rows) {
    const fullName = row.fullName?.trim();
    const workEmail = row.workEmail?.trim();

    if (!fullName || !workEmail) {
      skipped += 1;
      errors.push({ row, reason: 'Missing fullName or workEmail' });
      continue;
    }

    const normalisedEmail = normaliseEmail(workEmail);
    if (seenEmails.has(normalisedEmail)) {
      skipped += 1;
      errors.push({ row, reason: 'Duplicate email in batch' });
      continue;
    }
    seenEmails.add(normalisedEmail);

    try {
      const { created } = await upsertProfile(organizationId, importingUserId, {
        ...row,
        fullName,
        workEmail,
        hrSource,
      });

      if (created) {
        imported += 1;
      } else {
        updated += 1;
      }
    } catch (err) {
      skipped += 1;
      errors.push({ row, reason: err.message || 'Failed to upsert profile' });
    }
  }

  return { imported, updated, skipped, errors };
};

/**
 * Mark an employee as departed and trigger offboarding workflows
 */
export const departEmployee = async (organizationId, profileId, endDate, departedBy) => {
  const profile = await findProfileOrThrow(organizationId, profileId);
  const resolvedEndDate = endDate || new Date();

  profile.employmentStatus = 'departed';
  profile.endDate = resolvedEndDate;
  await profile.save();

  if (profile.userId) {
    try {
      await OffboardingEvent.create({
        organizationId,
        userId: profile.userId,
        startedBy: departedBy,
        offboardingType: 'PERMANENT',
        status: 'OPEN',
        reason: 'Marked departed via HR integration',
      });
    } catch (err) {
      console.error('[hrIntegration] Failed to create OffboardingEvent:', err.message);
    }
  }

  (async () => {
    try {
      const admins = await User.find({
        organizationId,
        role: 'ADMIN',
        isDeleted: false,
      });

      const subject = `Employee Departed: ${profile.fullName}`;
      const body = `${profile.fullName} (${profile.workEmail}) marked departed as of ${resolvedEndDate}. Review and deprovision their system access.`;

      await Promise.all(
        admins.map((admin) =>
          emailService
            .sendNotificationEmail(
              admin.email,
              `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
              subject,
              body
            )
            .catch(() => {})
        )
      );
    } catch {
      // Swallow email errors
    }
  })();

  return profile;
};

/**
 * Compute policy attestation status for a linked platform user
 */
export const getPolicyStatus = async (organizationId, profileId) => {
  const profile = await findProfileOrThrow(organizationId, profileId);

  if (!profile.userId) {
    return { total: 0, acknowledged: 0, pending: 0, overdue: 0, unlinked: true };
  }

  const activeVersions = await PolicyVersion.find({
    organizationId,
    status: 'ACTIVE',
  })
    .select('_id policyId')
    .lean();

  const total = activeVersions.length;
  if (total === 0) {
    return { total: 0, acknowledged: 0, pending: 0, overdue: 0 };
  }

  const versionIds = activeVersions.map((v) => v._id);
  const acknowledged = await PolicyAttestation.countDocuments({
    userId: profile.userId,
    policyVersionId: { $in: versionIds },
  });

  const pending = Math.max(0, total - acknowledged);

  return { total, acknowledged, pending, overdue: 0 };
};

/**
 * Aggregate HR profile counts for an organisation
 */
export const getStats = async (organizationId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const baseFilter = { organizationId, isDeleted: false };

  const [total, active, departed, onLeave, newThisMonth] = await Promise.all([
    HrProfile.countDocuments(baseFilter),
    HrProfile.countDocuments({ ...baseFilter, employmentStatus: 'active' }),
    HrProfile.countDocuments({ ...baseFilter, employmentStatus: 'departed' }),
    HrProfile.countDocuments({ ...baseFilter, employmentStatus: 'on_leave' }),
    HrProfile.countDocuments({
      ...baseFilter,
      startDate: { $gte: startOfMonth, $lt: startOfNextMonth },
    }),
  ]);

  return { total, active, departed, onLeave, newThisMonth };
};

/**
 * Link internal controls to an HR profile and create companion evidence
 */
export const linkToControl = async (organizationId, profileId, controlIds) => {
  const profile = await findProfileOrThrow(organizationId, profileId);

  const existingIds = profile.linkedControlIds.map((id) => id.toString());
  const newIds = controlIds.filter((id) => !existingIds.includes(id.toString()));

  if (newIds.length > 0) {
    profile.linkedControlIds.push(...newIds);
    await profile.save();

    await createCompanionEvidence(
      organizationId,
      'hr_profile',
      profileId.toString(),
      profile.fullName,
      'HR employee compliance record',
      profile.linkedControlIds.map((id) => id.toString()),
      profile.createdBy
    );
  }

  return profile;
};

/**
 * Remove a linked control from an HR profile
 */
export const unlinkFromControl = async (organizationId, profileId, controlId) => {
  const profile = await findProfileOrThrow(organizationId, profileId);

  profile.linkedControlIds = profile.linkedControlIds.filter(
    (id) => id.toString() !== controlId.toString()
  );

  await profile.save();

  const evidence = await Evidence.findOne({
    organizationId,
    source: 'hr_profile',
    externalId: profileId.toString(),
  });
  if (evidence) {
    if (profile.linkedControlIds.length === 0) {
      evidence.isDeleted = true;
      evidence.deletedAt = new Date();
    } else {
      evidence.linkedControlIds = profile.linkedControlIds;
    }
    await evidence.save();
  }

  return profile;
};
