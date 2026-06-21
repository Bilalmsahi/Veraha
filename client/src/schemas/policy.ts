/**
 * Policy schemas - mirrors server validators
 */

import { z } from 'zod';

const REVIEW_FREQUENCY = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUALLY',
  'ANNUALLY',
  'BIENNIALLY',
  'WEEKLY',
  'NEVER',
] as const;

export const createPolicySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  reviewFrequency: z.enum(REVIEW_FREQUENCY).default('ANNUALLY'),
  requiresAttestation: z.boolean().default(true),
});

export const updatePolicySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  approverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  assignmentScope: z
    .enum(['ALL_PERSONNEL', 'SPECIFIC_GROUPS', 'SPECIFIC_USERS', 'SPECIFIC_ROLES'])
    .optional(),
  assignmentGroupIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  assignmentUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
  targetRoles: z.array(z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'])).optional(),
  reviewFrequency: z.enum(REVIEW_FREQUENCY).optional(),
  requiresAttestation: z.boolean().optional(),
});

export const createVersionSchema = z.object({
  changelog: z.string().max(2000).optional(),
  effectiveDate: z.coerce.date().optional(),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
