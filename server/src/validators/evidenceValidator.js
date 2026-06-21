/**
 * Evidence Validators
 * Zod schemas for Evidence API endpoints
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

/**
 * Create evidence schema (metadata only - file handled by multer)
 */
export const createEvidenceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z
    .union([
      // Handle comma-separated string from form-data
      z.string().transform((val) =>
        val
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
      // Handle array from JSON
      z.array(z.string()),
    ])
    .optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  linkedControlIds: z
    .union([
      // Handle comma-separated string from form-data
      z.string().transform((val) =>
        val
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      ),
      // Handle array from JSON
      z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')),
    ])
    .optional(),
  source: z.string().max(100).optional(),
  externalId: z.string().max(200).optional(),
  isSensitive: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional()
    .default(false),
}).refine(
  (data) => !data.validUntil || !data.validFrom || data.validUntil > data.validFrom,
  { message: 'validUntil must be after validFrom', path: ['validUntil'] }
);

/**
 * Update evidence schema
 */
export const updateEvidenceSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  isSensitive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  linkedControlIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID'))
    .optional(),
});

export const createCustomDocumentSchema = z.object({
  title: z.string().min(3, 'Document name must be at least 3 characters').max(200),
  description: z.string().max(2000).optional(),
  isSensitive: z.boolean().optional().default(false),
  recurrence: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'NEVER']).default('ANNUALLY'),
  linkedControlIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID'))
    .optional(),
});

/**
 * Review (approve/reject) evidence schema
 */
export const reviewEvidenceSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional(),
});

/**
 * Link controls schema (empty array allowed = unlink all)
 */
export const linkControlsSchema = z.object({
  controlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).min(0),
});

/**
 * List evidence query schema
 */
export const listEvidenceQuerySchema = paginationSchema.extend({
  status: z.string().optional(), // comma-separated: PENDING,APPROVED,EXPIRED
  category: z.string().optional(),
  controlId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID').optional(),
  sources: z.string().optional(), // comma-separated: aws_account,aws_finding,hr_profile,device
  uploadedBy: z
    .union([
      z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID'),
      z.literal('__unassigned__'),
      z.literal('__needs_reassignment__'),
    ])
    .optional(),
  frameworkId: z
    .union([
      z.string().regex(/^[a-f\d]{24}$/i, 'Invalid framework ID'),
      z.literal('__none__'),
    ])
    .optional(),
  tab: z.enum(['all', 'owned', 'needs_document', 'draft']).optional(),
  overallStatus: z.enum(['OK', 'DUE_SOON', 'OVERDUE', 'NEEDS_REMEDIATION']).optional(),
  expiring: z.enum(['true', 'false']).optional(),
  expired: z.enum(['true', 'false']).optional(),
  validUntilFrom: z.string().optional(), // ISO date string for renew-by range
  validUntilTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['title', 'createdAt', 'validUntil', 'status', 'sizeBytes'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Evidence ID param schema
 */
export const evidenceIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Evidence version ID param (evidence/:id/versions/:versionId)
 */
export const evidenceVersionIdParamSchema = z.object({
  id: objectIdSchema,
  versionId: objectIdSchema,
});

/**
 * Evidence version file ID param (for DELETE file from version)
 */
export const evidenceVersionFileIdParamSchema = z.object({
  id: objectIdSchema,
  versionId: objectIdSchema,
  fileId: objectIdSchema,
});

/**
 * Control ID param schema (for evidence by control)
 */
export const controlIdParamSchema = z.object({
  controlId: objectIdSchema,
});

/**
 * Expiring days query schema
 */
export const expiringQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

export default {
  createEvidenceSchema,
  createCustomDocumentSchema,
  updateEvidenceSchema,
  reviewEvidenceSchema,
  linkControlsSchema,
  listEvidenceQuerySchema,
  evidenceIdParamSchema,
  evidenceVersionIdParamSchema,
  evidenceVersionFileIdParamSchema,
  controlIdParamSchema,
  expiringQuerySchema,
};
