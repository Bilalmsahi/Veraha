import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';
import { DEVICE_SETTINGS_CHECKLIST_KEYS } from '../constants/deviceSettingsChecklist.js';

const DEVICE_OS = ['macOS', 'Windows', 'Linux', 'Other'];
const COMPLIANCE_STATUS = ['all', 'compliant', 'issues'];
const OVERALL_COMPLIANCE_STATUS = ['compliant', 'non_compliant', 'needs_review'];
const MDM_SOURCE = ['manual', 'jamf', 'kandji', 'intune', 'jumpcloud', 'ninjaone', 'other'];
const DEVICE_TYPE = ['laptop', 'desktop', 'mobile', 'server', 'other'];
const MDM_ENROLLMENT_STATUS = ['enrolled', 'not_enrolled', 'unknown'];

const complianceSchema = z.object({
  antivirusInstalled: z.boolean().default(false),
  antivirusName: z.string().max(200).optional(),
  diskEncryptionEnabled: z.boolean().default(false),
  screenLockEnabled: z.boolean().default(false),
  passwordManagerInstalled: z.boolean().default(false),
  osUpToDate: z.boolean().optional(),
  lastVerifiedDate: z.coerce.date().optional().nullable(),
});

export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(200),
  assignedUserId: objectIdSchema,
  os: z.enum(DEVICE_OS),
  osVersion: z.string().max(100).optional().or(z.literal('')),
  serialNumber: z.string().max(200).optional().or(z.literal('')),
  deviceType: z.enum(DEVICE_TYPE).optional(),
  mdmSource: z.enum(MDM_SOURCE).optional(),
  mdmEnrollmentStatus: z.enum(MDM_ENROLLMENT_STATUS).optional(),
  compliance: complianceSchema.default({}),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export const updateDeviceSchema = createDeviceSchema.partial().extend({
  compliance: complianceSchema.partial().optional(),
});

export const listDevicesQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  complianceStatus: z.enum(COMPLIANCE_STATUS).default('all'),
  overallComplianceStatus: z.enum(OVERALL_COMPLIANCE_STATUS).optional(),
  os: z.string().optional(),
  mdmSource: z.enum(MDM_SOURCE).optional(),
  sortBy: z.enum(['name', 'os', 'lastUpdated', 'createdAt', 'updatedAt', 'overallComplianceStatus']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const checklistItemInputSchema = z.object({
  key: z.enum(DEVICE_SETTINGS_CHECKLIST_KEYS),
  checked: z.coerce.boolean(),
});

export const submitDeviceSettingsSchema = z.object({
  checklistItems: z.preprocess((value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }, z.array(checklistItemInputSchema)),
});

export const deviceProofFileParamSchema = z.object({
  id: objectIdSchema,
  evidenceId: objectIdSchema,
  fileId: objectIdSchema,
});

export const deviceIdParamSchema = z.object({
  id: objectIdSchema,
});

export const linkControlsSchema = z.object({
  controlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).min(1),
});

export const deviceControlParamSchema = z.object({
  id: objectIdSchema,
  controlId: objectIdSchema,
});

export const deviceEvidenceParamSchema = z.object({
  id: objectIdSchema,
  evidenceId: objectIdSchema,
});

export default {
  createDeviceSchema,
  updateDeviceSchema,
  listDevicesQuerySchema,
  submitDeviceSettingsSchema,
  deviceIdParamSchema,
  deviceEvidenceParamSchema,
  deviceProofFileParamSchema,
};
