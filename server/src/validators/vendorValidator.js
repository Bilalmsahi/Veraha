/**
 * Vendor Validators
 * Zod schemas for Vendor API endpoints
 * 
 * Uses shared enums from models/enums.js for consistency
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';
import { REVIEW_FREQUENCY } from '../models/enums.js';

const VENDOR_RISK_TIER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED'];
const VENDOR_STATUS_ENUM = ['ACTIVE', 'ARCHIVED'];

// =============================================================================
// CONTACT SCHEMA (reusable)
// =============================================================================

const contactSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
}).optional();

// =============================================================================
// CERTIFICATION SCHEMA
// =============================================================================

const certificationSchema = z.object({
  name: z.string().min(1).max(100),
  validUntil: z.coerce.date().optional(),
  // documentUrl is managed server-side when files are uploaded via storageService
});

// =============================================================================
// VENDOR SCHEMAS
// =============================================================================

/**
 * Create vendor schema
 */
export const createVendorSchema = z.object({
  name: z.string().min(2, 'Vendor name must be at least 2 characters').max(200),
  description: z.string().max(2000).optional(),
  serviceType: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  // Risk assessment (Vanta: UNSCORED default)
  riskTier: z.enum(VENDOR_RISK_TIER).default('UNSCORED'),
  // Status (Vanta: ACTIVE | ARCHIVED)
  status: z.enum(VENDOR_STATUS_ENUM).default('ACTIVE'),
  // Linked controls
  linkedControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).optional(),
  // Contact
  primaryContact: contactSchema,
  securityContact: contactSchema,
  // Contract
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  hasNda: z.boolean().default(false),
  hasDpa: z.boolean().default(false),
  hasSla: z.boolean().default(false),
  // Assessment
  assessmentFrequency: z.enum(REVIEW_FREQUENCY).default('ANNUALLY'),
  nextAssessmentDate: z.coerce.date().optional(),
  // Certifications
  certifications: z.array(certificationSchema).optional(),
  // Data Processing (free-text arrays like Vanta)
  dataTypes: z.array(z.string()).optional(),
  dataShared: z.array(z.string()).optional(),
  dataLocation: z.string().max(200).optional(),
  // Notes
  notes: z.string().max(2000).optional(),
  // Ownership
  ownerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid owner ID').optional(),
});

/**
 * Update vendor schema
 */
export const updateVendorSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  serviceType: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')).nullable(),
  riskTier: z.enum(VENDOR_RISK_TIER).optional(),
  status: z.enum(VENDOR_STATUS_ENUM).optional(),
  linkedControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  primaryContact: contactSchema,
  securityContact: contactSchema,
  contractStartDate: z.coerce.date().optional().nullable(),
  contractEndDate: z.coerce.date().optional().nullable(),
  hasNda: z.boolean().optional(),
  hasDpa: z.boolean().optional(),
  hasSla: z.boolean().optional(),
  assessmentFrequency: z.enum(REVIEW_FREQUENCY).optional(),
  nextAssessmentDate: z.coerce.date().optional().nullable(),
  certifications: z.array(certificationSchema).optional(),
  dataTypes: z.array(z.string()).optional(),
  dataShared: z.array(z.string()).optional(),
  dataLocation: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
});

/**
 * List vendors query schema
 */
export const listVendorsQuerySchema = paginationSchema.extend({
  status: z.string().optional(), // comma-separated: ACTIVE,ARCHIVED
  riskTier: z.string().optional(), // comma-separated: CRITICAL,HIGH,MEDIUM,LOW
  category: z.string().optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  assessmentDue: z.enum(['true', 'false']).optional(), // Overdue for assessment
  contractExpiring: z.coerce.number().int().min(0).optional(), // Days until contract expires
  hasNda: z.enum(['true', 'false']).optional(),
  hasDpa: z.enum(['true', 'false']).optional(),
  dataType: z.string().optional(), // Filter by data type handled
  search: z.string().optional(),
  sortBy: z.enum([
    'name', 'createdAt', 'updatedAt', 'riskTier', 'status',
    'nextAssessmentDate', 'contractEndDate',
  ]).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Record assessment schema
 */
export const recordAssessmentSchema = z.object({
  riskTier: z.enum(VENDOR_RISK_TIER).optional(),
  notes: z.string().max(2000).optional(),
  nextAssessmentDate: z.coerce.date().optional(),
});

/**
 * Link controls schema
 */
export const linkControlsSchema = z.object({
  controlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).min(1),
});

/**
 * Update status schema (Vanta: ACTIVE | ARCHIVED)
 */
export const updateStatusSchema = z.object({
  status: z.enum(VENDOR_STATUS_ENUM),
  reason: z.string().max(500).optional(),
});

/**
 * Add certification schema
 * Used with multipart/form-data; validUntil may arrive as empty string from form fields
 */
export const addCertificationSchema = z.object({
  name: z.string().min(1, 'Certification name is required').max(100),
  validUntil: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.coerce.date().optional()
  ),
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const vendorIdParamSchema = z.object({
  id: objectIdSchema,
});

export const certificationIndexParamSchema = z.object({
  id: objectIdSchema,
  certIndex: z.coerce.number().int().min(0),
});

export default {
  createVendorSchema,
  updateVendorSchema,
  listVendorsQuerySchema,
  recordAssessmentSchema,
  linkControlsSchema,
  updateStatusSchema,
  addCertificationSchema,
  vendorIdParamSchema,
  certificationIndexParamSchema,
};
