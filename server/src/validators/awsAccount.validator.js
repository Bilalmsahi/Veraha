/**
 * AWS Account Validators
 * Zod schemas for AWS Account API endpoints
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

const ENVIRONMENT_TYPE = ['production', 'staging', 'development', 'other'];
const AWS_ACCOUNT_STATUS = ['active', 'inactive', 'unverified'];

// =============================================================================
// AWS ACCOUNT SCHEMAS
// =============================================================================

/**
 * Create AWS account schema
 */
export const createAwsAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(200),
  awsAccountId: z.string().regex(/^\d{12}$/, 'AWS Account ID must be exactly 12 digits'),
  regions: z.array(z.string()).optional().default([]),
  environmentType: z.enum(ENVIRONMENT_TYPE).optional(),
  ownerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid owner ID').optional(),
  status: z.enum(AWS_ACCOUNT_STATUS).default('active'),
  notes: z.string().max(2000).optional(),
});

/**
 * Update AWS account schema
 */
export const updateAwsAccountSchema = createAwsAccountSchema.partial();

/**
 * Link controls schema
 */
export const linkControlsSchema = z.object({
  controlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid control ID')).min(1),
});

/**
 * List AWS accounts query schema
 */
export const listAwsAccountsQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const awsAccountIdParamSchema = z.object({
  id: objectIdSchema,
});

export const awsAccountControlParamSchema = z.object({
  id: objectIdSchema,
  controlId: objectIdSchema,
});

export const findingControlParamSchema = z.object({
  id: objectIdSchema,
  controlId: objectIdSchema,
});

export default {
  createAwsAccountSchema,
  updateAwsAccountSchema,
  linkControlsSchema,
  listAwsAccountsQuerySchema,
  awsAccountIdParamSchema,
  awsAccountControlParamSchema,
  findingControlParamSchema,
};
