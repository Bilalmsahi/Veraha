import mongoose from 'mongoose';
import Framework from '../models/Framework.js';
import Organization from '../models/Organization.js';
import OrganizationFramework from '../models/OrganizationFramework.js';
import InternalControl from '../models/InternalControl.js';

const toStringId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

const toObjectIds = (values) =>
  values
    .map((value) => toStringId(value))
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

export async function getGrantedFrameworkIdSet(organizationId) {
  const [organization, grants] = await Promise.all([
    Organization.findById(organizationId).select('settings.enabledFrameworks').lean(),
    OrganizationFramework.find({ organizationId, revokedAt: null }).select('frameworkId').lean(),
  ]);

  return new Set([
    ...((organization?.settings?.enabledFrameworks || []).map(toStringId).filter(Boolean)),
    ...(grants.map((grant) => toStringId(grant.frameworkId)).filter(Boolean)),
  ]);
}

export async function hasAnyGrantedFramework(organizationId) {
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);
  return grantedFrameworkIds.size > 0;
}

export async function isFrameworkGrantedForOrg(organizationId, frameworkIdOrCode) {
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);
  if (grantedFrameworkIds.has(toStringId(frameworkIdOrCode))) return true;

  const code = String(frameworkIdOrCode || '').toUpperCase();
  if (!code || mongoose.Types.ObjectId.isValid(code)) return false;
  const framework = await Framework.findOne({ code, isActive: true }).select('_id').lean();
  return framework ? grantedFrameworkIds.has(framework._id.toString()) : false;
}

export async function assertFrameworkGrantedForOrg(organizationId, frameworkIdOrCode) {
  if (await isFrameworkGrantedForOrg(organizationId, frameworkIdOrCode)) return;
  const error = new Error('Framework access is locked for this organization');
  error.statusCode = 403;
  throw error;
}

export function entityLinkedFrameworkIdsFromControl(control) {
  return (control?.linkedRequirements || [])
    .map((link) => toStringId(link.frameworkId))
    .filter(Boolean);
}

export async function isControlAccessibleForOrg(control, organizationId) {
  const linkedFrameworkIds = entityLinkedFrameworkIdsFromControl(control);
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);

  if (linkedFrameworkIds.length === 0) return grantedFrameworkIds.size > 0;
  return linkedFrameworkIds.some((frameworkId) => grantedFrameworkIds.has(frameworkId));
}

export async function assertControlAccessibleForOrg(control, organizationId) {
  if (await isControlAccessibleForOrg(control, organizationId)) return;
  const error = new Error('Purchase the linked framework to access this control');
  error.statusCode = 403;
  throw error;
}

export async function buildAccessibleControlMatch(organizationId) {
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);
  if (grantedFrameworkIds.size === 0) {
    return { _id: { $in: [] } };
  }

  const grantedObjectIds = toObjectIds([...grantedFrameworkIds]);
  return {
    $or: [
      { 'linkedRequirements.frameworkId': { $in: grantedObjectIds } },
      { linkedRequirements: { $size: 0 } },
      { linkedRequirements: { $exists: false } },
    ],
  };
}

export async function getAccessibleControlIds(organizationId) {
  const accessMatch = await buildAccessibleControlMatch(organizationId);
  const controls = await InternalControl.find({
    organizationId,
    isDeleted: false,
    isActive: { $ne: false },
    ...accessMatch,
  }).select('_id').lean();

  return controls.map((control) => control._id);
}

export async function buildLinkedControlEntityAccessMatch(organizationId, linkedControlField = 'linkedControlIds') {
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);
  if (grantedFrameworkIds.size === 0) {
    return { _id: { $in: [] } };
  }

  const accessibleControlIds = await getAccessibleControlIds(organizationId);
  return {
    $or: [
      { [linkedControlField]: { $in: accessibleControlIds } },
      { [linkedControlField]: { $size: 0 } },
      { [linkedControlField]: { $exists: false } },
    ],
  };
}

export async function buildPolicyAccessMatch(organizationId) {
  const grantedFrameworkIds = await getGrantedFrameworkIdSet(organizationId);
  if (grantedFrameworkIds.size === 0) {
    return { _id: { $in: [] } };
  }

  const accessibleControlIds = await getAccessibleControlIds(organizationId);
  const grantedObjectIds = toObjectIds([...grantedFrameworkIds]);
  return {
    $or: [
      { frameworkIds: { $in: grantedObjectIds } },
      { linkedControlIds: { $in: accessibleControlIds } },
      {
        $and: [
          { $or: [{ frameworkIds: { $size: 0 } }, { frameworkIds: { $exists: false } }] },
          { $or: [{ linkedControlIds: { $size: 0 } }, { linkedControlIds: { $exists: false } }] },
        ],
      },
    ],
  };
}

export function andAccess(query, accessMatch) {
  if (!accessMatch || Object.keys(accessMatch).length === 0) return query;
  return { $and: [query, accessMatch] };
}

export default {
  getGrantedFrameworkIdSet,
  hasAnyGrantedFramework,
  isFrameworkGrantedForOrg,
  assertFrameworkGrantedForOrg,
  isControlAccessibleForOrg,
  assertControlAccessibleForOrg,
  buildAccessibleControlMatch,
  getAccessibleControlIds,
  buildLinkedControlEntityAccessMatch,
  buildPolicyAccessMatch,
  andAccess,
};
