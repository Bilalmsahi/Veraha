/**
 * Risk Validators
 * Zod schemas for Risk API endpoints
 * 
 * Uses shared enums from models/enums.js for consistency
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';
import { TREATMENT, RISK_STATUS } from '../models/enums.js';

// =============================================================================
// RISK SCHEMAS
// =============================================================================

/**
 * Create risk schema
 */
export const createRiskSchema = z.object({
  identifier: z.string().max(50).optional(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).optional(),
  ciaCategories: z
    .array(z.enum(['Confidentiality', 'Integrity', 'Availability']))
    .optional(),
  likelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  impact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  residualLikelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  residualImpact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  assessmentNotes: z.string().max(2000).optional(),
  treatment: z.enum(TREATMENT).nullable().optional(),
  treatmentPlan: z.string().max(2000).optional(),
  // Ownership
  ownerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid owner ID').optional(),
  // Mitigating controls
  mitigatingControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).optional(),
  // Review schedule
  nextReviewDue: z.coerce.date().optional(),
});

/**
 * Update risk schema
 */
export const updateRiskSchema = z.object({
  identifier: z.string().max(50).optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).optional(),
  ciaCategories: z
    .array(z.enum(['Confidentiality', 'Integrity', 'Availability']))
    .optional(),
  likelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  impact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  residualLikelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  residualImpact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  assessmentNotes: z.string().max(2000).optional(),
  treatment: z.enum([...TREATMENT]).nullable().optional(),
  treatmentPlan: z.string().max(2000).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  mitigatingControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  nextReviewDue: z.coerce.date().nullable().optional(),
});

/**
 * List risks query schema (Vanta-aligned filters)
 */
export const listRisksQuerySchema = paginationSchema.extend({
  status: z.string().optional(), // Vanta: DRAFT,NEEDS_REVIEW,PENDING_APPROVAL,APPROVED; or OPEN,CLOSED
  riskLevel: z.string().optional(),
  treatment: z.string().optional(),
  treatmentPlan: z.string().optional(), // Vanta "Treatment plan" filter
  category: z.string().optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  owner: z.string().optional(), // Vanta: __me__, __unassigned__, __needs_reassignment__
  inherent: z.string().optional(), // Vanta: HIGH, MED, LOW
  residual: z.string().optional(), // Vanta: HIGH, MED, LOW
  approverId: z.string().optional(), // Reserved for future approver filter
  reviewDue: z.enum(['true', 'false']).optional(),
  stale: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum([
    'title', 'createdAt', 'updatedAt', 'inherentScore',
    'residualScore', 'riskLevel', 'nextReviewDue',
  ]).default('residualScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  // Add-filter params (optional)
  ciaCategories: z.string().optional(),
  identified: z.string().optional(),
  source: z.string().optional(),
});

/**
 * Close risk schema
 */
export const closeRiskSchema = z.object({
  closureReason: z.string().min(10, 'Closure reason must be at least 10 characters').max(1000),
});

/**
 * Reopen risk schema
 */
export const reopenRiskSchema = z.object({
  reason: z.string().min(10).max(1000).optional(),
});

/**
 * Link controls schema
 */
export const linkControlsSchema = z.object({
  controlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).min(1),
});

/**
 * Review risk schema
 */
export const reviewRiskSchema = z.object({
  likelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  impact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  notes: z.string().max(2000).optional(),
  nextReviewDue: z.coerce.date().optional(),
});

export const approveRiskSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
});

export const submitRiskApprovalSchema = z.object({
  approverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid approver ID')).min(1),
  notes: z.string().max(2000).nullable().optional(),
});

export const getRiskAssessmentsSchema = z.object({
  id: objectIdSchema,
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const riskIdParamSchema = z.object({
  id: objectIdSchema,
});

export default {
  createRiskSchema,
  updateRiskSchema,
  listRisksQuerySchema,
  closeRiskSchema,
  reopenRiskSchema,
  linkControlsSchema,
  reviewRiskSchema,
  approveRiskSchema,
  submitRiskApprovalSchema,
  getRiskAssessmentsSchema,
  riskIdParamSchema,
};
