/**
 * AWS Finding Validators
 * Zod schemas for AWS Finding API endpoints
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

const FINDING_SEVERITY = ['critical', 'high', 'medium', 'low', 'informational'];
const AFFECTED_SERVICE = [
  'EC2',
  'S3',
  'IAM',
  'RDS',
  'CloudTrail',
  'VPC',
  'GuardDuty',
  'Inspector',
  'Lambda',
  'KMS',
  'CloudWatch',
  'Other',
];
const FINDING_STATUS = ['open', 'in_remediation', 'resolved', 'accepted_risk'];

// =============================================================================
// AWS FINDING SCHEMAS
// =============================================================================

/**
 * Create AWS finding schema
 */
export const createAwsFindingSchema = z.object({
  title: z.string().min(1).max(500),
  severity: z.enum(FINDING_SEVERITY),
  affectedService: z.enum(AFFECTED_SERVICE).optional(),
  description: z.string().min(1).max(5000),
  detectedOn: z.coerce.date(),
  status: z.enum(FINDING_STATUS).default('open'),
  region: z.string().max(100).optional(),
  resourceType: z.string().max(200).optional(),
  resourceId: z.string().max(500).optional(),
  remediationNotes: z.string().max(5000).optional(),
  resolvedOn: z.coerce.date().optional().nullable(),
});

/**
 * Update AWS finding schema
 */
export const updateAwsFindingSchema = createAwsFindingSchema.partial();

/**
 * List findings query schema
 */
export const listFindingsQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  severity: z.string().optional(),
  service: z.string().optional(),
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const awsFindingIdParamSchema = z.object({
  id: objectIdSchema,
});

export const awsFindingAccountParamSchema = z.object({
  accountId: objectIdSchema,
});

export default {
  createAwsFindingSchema,
  updateAwsFindingSchema,
  listFindingsQuerySchema,
  awsFindingIdParamSchema,
  awsFindingAccountParamSchema,
};
