import mongoose from 'mongoose';
import Device from '../models/Device.js';
import DeviceEvidence from '../models/DeviceEvidence.js';
import Evidence from '../models/Evidence.js';
import User from '../models/User.js';
import { storageService } from './storageService.js';
import { logCrudOperation } from './activityLogger.js';
import { createCompanionEvidence } from './awsIntegration.service.js';
import {
  DEVICE_SETTINGS_CHECKLIST,
  normalizeChecklistItems,
} from '../constants/deviceSettingsChecklist.js';

const populateDevice = (query) =>
  query.populate('assignedUserId', 'firstName lastName email');

const FILE_FIELD_BY_KEY = {
  diskEncryptionEnabled: 'file_diskEncryptionEnabled',
  screenLockEnabled: 'file_screenLockEnabled',
  antivirus: 'file_antivirus',
  passwordManager: 'file_passwordManager',
};

const sanitizeEvidenceFile = (file) => ({
  _id: String(file._id),
  originalName: file.originalName || '',
  mimeType: file.mimeType || '',
  sizeBytes: file.sizeBytes ?? null,
});

export const sanitizeDeviceEvidence = (evidence) => {
  if (!evidence) return evidence;
  const row = evidence.toObject ? evidence.toObject() : { ...evidence };
  const evidenceFiles = (row.evidenceFiles || []).map(sanitizeEvidenceFile);
  const fileById = new Map(evidenceFiles.map((file) => [file._id, file]));

  return {
    ...row,
    _id: String(row._id),
    deviceId: String(row.deviceId),
    evidenceFiles,
    checklistItems: normalizeChecklistItems(row).map((item) => ({
      ...item,
      evidenceFile: item.evidenceFileId ? fileById.get(item.evidenceFileId) || null : null,
    })),
  };
};

const ensureAssignedUserInOrg = async (assignedUserId, organizationId) => {
  if (!assignedUserId) return;
  const exists = await User.exists({
    _id: assignedUserId,
    organizationId,
    isDeleted: { $ne: true },
  });
  if (!exists) {
    const error = new Error('Assigned user not found');
    error.statusCode = 400;
    throw error;
  }
};

export const createDevice = async (data, user) => {
  const { organizationId, userId } = user;
  await ensureAssignedUserInOrg(data.assignedUserId, organizationId);

  const device = await Device.create({
    organizationId,
    ...data,
    lastUpdated: new Date(),
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Device',
    entityId: device._id,
    entitySnapshot: { name: device.name, os: device.os },
  });

  return populateDevice(Device.findById(device._id));
};

export const listDevices = async (organizationId, filters) => {
  const {
    page = 1,
    limit = 20,
    search,
    complianceStatus = 'all',
    overallComplianceStatus,
    os,
    mdmSource,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filters;

  const query = { organizationId, isDeleted: false };

  if (complianceStatus === 'compliant') {
    query.overallComplianceStatus = 'compliant';
  } else if (complianceStatus === 'issues') {
    query.overallComplianceStatus = { $in: ['non_compliant', 'needs_review'] };
  }

  if (overallComplianceStatus) {
    query.overallComplianceStatus = overallComplianceStatus;
  }

  if (os) {
    query.os = os;
  }

  if (mdmSource) {
    query.mdmSource = mdmSource;
  }

  let assignedUserIds = [];
  if (search) {
    const users = await User.find({
      organizationId,
      isDeleted: { $ne: true },
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();
    assignedUserIds = users.map((u) => u._id);

    const searchOr = [
      { name: { $regex: search, $options: 'i' } },
      { serialNumber: { $regex: search, $options: 'i' } },
    ];
    if (assignedUserIds.length) searchOr.push({ assignedUserId: { $in: assignedUserIds } });

    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const total = await Device.countDocuments(query);
  const devices = await populateDevice(
    Device.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit)
  ).lean();

  return {
    devices,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit),
      hasNextPage: normalizedPage < Math.ceil(total / normalizedLimit),
      hasPrevPage: normalizedPage > 1,
    },
  };
};

export const getDeviceById = async (deviceId, organizationId) => {
  const device = await populateDevice(
    Device.findOne({ _id: deviceId, organizationId, isDeleted: false })
  ).lean();

  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  const evidence = await DeviceEvidence.find({ deviceId, organizationId })
    .sort({ uploadedAt: -1 })
    .lean();

  return {
    ...device,
    evidence: evidence.map(sanitizeDeviceEvidence),
  };
};

export const updateDevice = async (deviceId, data, user) => {
  const { organizationId, userId } = user;
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });

  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.assignedUserId) {
    await ensureAssignedUserInOrg(data.assignedUserId, organizationId);
  }

  const before = device.toObject();
  if (data.name !== undefined) device.name = data.name;
  if (data.assignedUserId !== undefined) device.assignedUserId = data.assignedUserId;
  if (data.os !== undefined) device.os = data.os;
  if (data.osVersion !== undefined) device.osVersion = data.osVersion;
  if (data.serialNumber !== undefined) device.serialNumber = data.serialNumber;
  if (data.deviceType !== undefined) device.deviceType = data.deviceType;
  if (data.mdmSource !== undefined) device.mdmSource = data.mdmSource;
  if (data.mdmEnrollmentStatus !== undefined) device.mdmEnrollmentStatus = data.mdmEnrollmentStatus;
  if (data.notes !== undefined) device.notes = data.notes;
  if (data.compliance) {
    Object.assign(device.compliance, data.compliance);
  }
  device.lastUpdated = new Date();
  await device.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Device',
    entityId: device._id,
    entitySnapshot: { name: device.name },
    before,
    after: device.toObject(),
  });

  return populateDevice(Device.findById(device._id));
};

export const deleteDevice = async (deviceId, user) => {
  const { organizationId, userId } = user;
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });

  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  device.isDeleted = true;
  device.deletedAt = new Date();
  device.deletedBy = userId;
  device.lastUpdated = new Date();
  await device.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'DELETE',
    entityType: 'Device',
    entityId: device._id,
    entitySnapshot: { name: device.name },
  });

  return { deleted: true, id: deviceId };
};

export const getDeviceStats = async (organizationId) => {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const [total, compliant, nonCompliant, needsReview] = await Promise.all([
    Device.countDocuments({ organizationId, isDeleted: false }),
    Device.countDocuments({ organizationId: orgObjectId, isDeleted: false, overallComplianceStatus: 'compliant' }),
    Device.countDocuments({ organizationId: orgObjectId, isDeleted: false, overallComplianceStatus: 'non_compliant' }),
    Device.countDocuments({ organizationId: orgObjectId, isDeleted: false, overallComplianceStatus: 'needs_review' }),
  ]);

  return {
    total,
    compliant,
    nonCompliant,
    needsReview,
    issues: total - compliant,
  };
};

const buildChecklistItemsFromInput = (inputItems) => {
  const inputByKey = new Map((inputItems || []).map((item) => [item.key, item]));
  return DEVICE_SETTINGS_CHECKLIST.map((definition) => {
    const input = inputByKey.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      checked: Boolean(input?.checked),
      evidenceFileId: null,
    };
  });
};

export const submitDeviceSettings = async (deviceId, data, files, user) => {
  const { organizationId, userId, role } = user;
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }
  if (role === 'EMPLOYEE' && String(device.assignedUserId) !== String(userId)) {
    const error = new Error('You can only submit device settings for your assigned devices');
    error.statusCode = 403;
    throw error;
  }

  const checklistItems = buildChecklistItemsFromInput(data.checklistItems);
  const fileMap = files || {};

  const evidence = new DeviceEvidence({
    organizationId,
    deviceId,
    label: `Device settings: ${device.name}`,
    uploadedBy: userId,
    uploadedAt: new Date(),
    reviewStatus: role === 'EMPLOYEE' ? 'SUBMITTED' : 'APPROVED',
    reviewedBy: role === 'EMPLOYEE' ? null : userId,
    reviewedAt: role === 'EMPLOYEE' ? null : new Date(),
  });

  for (const item of checklistItems) {
    const fieldName = FILE_FIELD_BY_KEY[item.key];
    const upload = fieldName ? fileMap[fieldName]?.[0] : null;
    if (!upload) continue;
    if (!item.checked) {
      const error = new Error(`Cannot upload proof for unchecked item: ${item.label}`);
      error.statusCode = 400;
      throw error;
    }

    const uploadResult = await storageService.uploadFile(
      upload.buffer,
      organizationId.toString(),
      upload.originalname,
      upload.mimetype
    );

    const proofFile = evidence.evidenceFiles.create({
      fileKey: uploadResult.key,
      originalName: upload.originalname,
      mimeType: upload.mimetype,
      sizeBytes: uploadResult.size,
    });
    evidence.evidenceFiles.push(proofFile);
    item.evidenceFileId = proofFile._id;
  }

  evidence.checklistItems = checklistItems;
  await evidence.save();

  device.compliance.antivirusInstalled =
    checklistItems.find((item) => item.key === 'antivirus')?.checked ?? false;
  device.compliance.diskEncryptionEnabled =
    checklistItems.find((item) => item.key === 'diskEncryptionEnabled')?.checked ?? false;
  device.compliance.screenLockEnabled =
    checklistItems.find((item) => item.key === 'screenLockEnabled')?.checked ?? false;
  device.compliance.passwordManagerInstalled =
    checklistItems.find((item) => item.key === 'passwordManager')?.checked ?? false;
  device.lastUpdated = new Date();
  await device.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Device',
    entityId: device._id,
    entitySnapshot: { name: device.name, action: 'submit_device_settings' },
  });

  return sanitizeDeviceEvidence(evidence.toObject());
};

export const getDeviceProofAccessUrl = async (deviceId, evidenceId, fileId, user) => {
  const { organizationId, role } = user;
  if (!['ADMIN', 'MANAGER'].includes(role)) {
    const error = new Error('Not authorized to access device proof files');
    error.statusCode = 403;
    throw error;
  }

  const evidence = await DeviceEvidence.findOne({
    _id: evidenceId,
    deviceId,
    organizationId,
  }).lean();

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const proofFile = (evidence.evidenceFiles || []).find((file) => String(file._id) === String(fileId));
  if (!proofFile?.fileKey) {
    const error = new Error('Proof file not found');
    error.statusCode = 404;
    throw error;
  }

  const url = await storageService.getFileUrl(proofFile.fileKey);
  return {
    url,
    mimeType: proofFile.mimeType || '',
    originalName: proofFile.originalName || 'proof',
    expiresIn: null,
  };
};

export const deleteDeviceEvidence = async (deviceId, evidenceId, user) => {
  const { organizationId, userId } = user;
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  const evidence = await DeviceEvidence.findOne({ _id: evidenceId, deviceId, organizationId });
  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const keysToDelete = (evidence.evidenceFiles || []).map((file) => file.fileKey).filter(Boolean);
  for (const key of keysToDelete) {
    await storageService.deleteFile(key);
  }
  await evidence.deleteOne();

  device.lastUpdated = new Date();
  await device.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Device',
    entityId: device._id,
    entitySnapshot: { name: device.name, action: 'delete_evidence', evidenceLabel: evidence.label },
  });

  return { deleted: true, id: evidenceId };
};

export const linkControls = async (deviceId, organizationId, controlIds) => {
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  const existingIds = new Set(device.linkedControlIds.map((id) => id.toString()));
  const newIds = controlIds.filter((id) => !existingIds.has(id.toString()));
  if (newIds.length > 0) {
    device.linkedControlIds.push(...newIds);
    await device.save();

    await createCompanionEvidence(
      organizationId,
      'device',
      device._id.toString(),
      device.name,
      `Device compliance record (${device.os}${device.serialNumber ? ` - ${device.serialNumber}` : ''})`,
      device.linkedControlIds.map((id) => id.toString()),
      device.assignedUserId
    );
  }

  return device;
};

export const unlinkControl = async (deviceId, organizationId, controlId) => {
  const device = await Device.findOne({ _id: deviceId, organizationId, isDeleted: false });
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }

  device.linkedControlIds = device.linkedControlIds.filter(
    (id) => id.toString() !== controlId.toString()
  );
  await device.save();

  const evidence = await Evidence.findOne({
    organizationId,
    source: 'device',
    externalId: device._id.toString(),
  });
  if (evidence) {
    if (device.linkedControlIds.length === 0) {
      evidence.isDeleted = true;
      evidence.deletedAt = new Date();
    } else {
      evidence.linkedControlIds = device.linkedControlIds;
    }
    await evidence.save();
  }

  return device;
};

export default {
  createDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  getDeviceStats,
  submitDeviceSettings,
  getDeviceProofAccessUrl,
  deleteDeviceEvidence,
  sanitizeDeviceEvidence,
  linkControls,
  unlinkControl,
};
