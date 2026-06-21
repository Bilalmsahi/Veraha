/**
 * Control Validators (Zod Schemas)
 * Validation schemas for internal control endpoints.
 */

import { z } from 'zod';
import { objectIdSchema } from './commonValidator.js';

// Controls list can fetch more items when filtering by ids (e.g. policy linked controls)
const controlPaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Valid status values
const MANUAL_STATUS = ['PASS', 'FAIL', 'NOT_APPLICABLE'];
const OVERALL_STATUS = ['PASS', 'FAIL', 'WARNING', 'NOT_APPLICABLE', 'NOT_CONFIGURED'];

/**
 * Control list query parameters
 * Extends pagination with control-specific filters
 */
export const controlQuerySchema = controlPaginationSchema.extend({
  ids: z.string().optional(), // comma-separated control IDs
  status: z.string().optional(), // comma-separated: PASS,FAIL
  controlGroup: z.string().optional(),
  source: z.enum(['CUSTOM', 'VERAHA']).optional(),
  frameworkCode: z.string().transform(val => val?.toUpperCase()).optional(),
  /** RequirementCategory _id — controls linked to any requirement in this category */
  categoryId: objectIdSchema.optional(),
  /** Requirement _id — controls linked to this specific requirement */
  requirementId: objectIdSchema.optional(),
  requirementIdentifier: z.string().optional(),
  ownerId: objectIdSchema.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['identifier', 'title', 'overallStatus', 'lastAssessedAt', 'createdAt', 'controlGroup']).default('identifier'),
  includeRequirements: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
});

/**
 * Single control ID parameter
 */
export const controlIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Framework code parameter for gap analysis
 */
export const frameworkCodeParamSchema = z.object({
  frameworkCode: z.string().min(2).max(20).transform(val => val.toUpperCase()),
});

const FREQUENCY_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];

/**
 * Update control schema
 */
export const updateControlSchema = z.object({
  manualStatus: z.enum(MANUAL_STATUS).optional(),
  ownerId: objectIdSchema.nullable().optional(),
  implementationNotes: z.string().max(2000).optional(),
  nextAssessmentDue: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  frequency: z.enum(FREQUENCY_VALUES).optional(),
  isPurchased: z.boolean().optional(),
});

/**
 * Manual assessment schema
 */
export const assessControlSchema = z.object({
  status: z.enum(MANUAL_STATUS),
  notes: z.string().max(2000).optional(),
});

/**
 * Bulk update schema
 */
export const bulkUpdateSchema = z.object({
  controlIds: z.array(objectIdSchema).min(1).max(100),
  updates: z.object({
    manualStatus: z.enum(MANUAL_STATUS).optional(),
    ownerId: objectIdSchema.nullable().optional(),
  }).refine(data => data.manualStatus || data.ownerId !== undefined, {
    message: 'At least one field to update must be specified',
  }),
});

/**
 * Create control schema (custom control)
 */
export const createControlSchema = z.object({
  identifier: z.string().min(1).max(50),
  title: z.string().min(2).max(300).optional(),
  description: z.string().max(2000).optional(),
  controlGroup: z.string().max(100).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).default('QUARTERLY'),
  isPurchased: z.boolean().optional().default(true),
  implementationNotes: z.string().max(2000).optional(),
  nextAssessmentDue: z.coerce.date().optional(),
  ownerId: objectIdSchema.nullable().optional(),
});

/**
 * Template ID param for from-template creation
 */
export const templateIdParamSchema = z.object({
  templateId: objectIdSchema,
});

/**
 * Map a control to a framework requirement
 */
export const mapRequirementSchema = z.object({
  frameworkId: objectIdSchema,
  requirementId: objectIdSchema,
  coverage: z.enum(['FULL', 'PARTIAL', 'GAP']).default('FULL'),
  justification: z.string().max(2000).optional(),
});

export default {
  controlQuerySchema,
  controlIdParamSchema,
  frameworkCodeParamSchema,
  updateControlSchema,
  assessControlSchema,
  bulkUpdateSchema,
  createControlSchema,
  templateIdParamSchema,
  mapRequirementSchema,
};
