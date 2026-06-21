/**
 * Policy Validators
 * Zod schemas for Policy API endpoints
 * 
 * Uses shared enums from models/enums.js for consistency
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';
import { POLICY_STATUS, REVIEW_FREQUENCY } from '../models/enums.js';

const CONTENT_HTML_MAX_LENGTH = 10_000_000;

// =============================================================================
// POLICY SCHEMAS
// =============================================================================

/**
 * Create policy schema
 */
export const createPolicySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid owner ID').optional(),
  approverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid approver ID')).optional(),
  assignmentScope: z
    .enum(['ALL_PERSONNEL', 'SPECIFIC_GROUPS', 'SPECIFIC_USERS', 'SPECIFIC_ROLES'])
    .optional(),
  assignmentGroupIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid group ID')).optional(),
  assignmentUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID')).optional(),
  targetUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid target user ID')).optional(),
  targetRoles: z.array(z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'])).optional(),
  frameworkIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid framework ID')).optional(),
  linkedControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).optional(),
  reviewFrequency: z.enum(REVIEW_FREQUENCY).default('ANNUALLY'),
  requiresAttestation: z.boolean().default(true),
});

/**
 * Update policy schema
 */
export const updatePolicySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  approverId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  approverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  assignmentScope: z
    .enum(['ALL_PERSONNEL', 'SPECIFIC_GROUPS', 'SPECIFIC_USERS', 'SPECIFIC_ROLES'])
    .optional(),
  assignmentGroupIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  assignmentUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  targetUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  targetRoles: z.array(z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'])).optional(),
  frameworkIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  linkedControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  reviewFrequency: z.enum(REVIEW_FREQUENCY).optional(),
  requiresAttestation: z.boolean().optional(),
});

/**
 * List policies query schema
 */
export const listPoliciesQuerySchema = paginationSchema.extend({
  tab: z.enum(['all', 'needs_my_approval', 'needs_approval', 'needs_reassignment']).optional(),
  status: z.string().optional(), // comma-separated: DRAFT,ACTIVE,ARCHIVED
  latestVersion: z.enum(['APPROVED', 'DRAFT', 'NOT_STARTED']).optional(),
  category: z.string().optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  approverId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  frameworkId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  source: z.enum(['VANTA', 'CUSTOM']).optional(),
  requiresAttestation: z.enum(['true', 'false']).optional(),
  reviewDue: z.enum(['true', 'false']).optional(), // Overdue for review
  search: z.string().optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'status', 'nextReviewDue']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// =============================================================================
// POLICY VERSION SCHEMAS
// =============================================================================

/**
 * Create policy version schema (with optional file upload)
 */
export const createVersionSchema = z.object({
  contentHtml: z.string().max(CONTENT_HTML_MAX_LENGTH).optional(), // Rich text content
  changelog: z.string().max(2000).optional(),
  effectiveDate: z.coerce.date().optional(),
});

/**
 * Update version schema (only DRAFT versions can be edited)
 */
export const updateVersionSchema = z.object({
  contentHtml: z.string().max(CONTENT_HTML_MAX_LENGTH).optional(),
  changelog: z.string().max(2000).optional(),
  effectiveDate: z.coerce.date().optional(),
});

/**
 * Publish version schema
 */
export const publishVersionSchema = z.object({
  effectiveDate: z.coerce.date().optional(),
});

// =============================================================================
// ATTESTATION SCHEMAS
// =============================================================================

/**
 * Create attestation schema (employee signing)
 */
export const createAttestationSchema = z.object({
  signatureText: z
    .string()
    .max(500)
    .default('I acknowledge that I have read and understood this policy.'),
});

/**
 * List attestations query schema
 */
export const listAttestationsQuerySchema = paginationSchema.extend({
  userId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const policyIdParamSchema = z.object({
  id: objectIdSchema,
});

export const versionIdParamSchema = z.object({
  id: objectIdSchema,
  versionId: objectIdSchema,
});

export default {
  createPolicySchema,
  updatePolicySchema,
  listPoliciesQuerySchema,
  createVersionSchema,
  updateVersionSchema,
  publishVersionSchema,
  createAttestationSchema,
  listAttestationsQuerySchema,
  policyIdParamSchema,
  versionIdParamSchema,
};
