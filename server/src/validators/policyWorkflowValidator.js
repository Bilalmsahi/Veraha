import { z } from 'zod';

export const policyIdParamSchema = z.object({
  id: z.string().min(1),
});

export const policyWorkflowVersionParamsSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
});

export const submitForApprovalSchema = z.object({
  policyVersionId: z.string().min(1),
  approverId: z.string().min(1),
});

export const rejectVersionSchema = z.object({
  reason: z.string().trim().optional().default(''),
});

export const publishWorkflowSchema = z.object({
  policyVersionId: z.string().min(1),
  recipientType: z.enum(['ALL_PERSONNEL', 'SPECIFIC_USERS', 'SPECIFIC_GROUPS']).optional(),
  userIds: z.array(z.string().min(1)).optional().default([]),
  groupIds: z.array(z.string().min(1)).optional().default([]),
});

export const acknowledgeSchema = z.object({
  signatureText: z.string().trim().optional().default('Acknowledged'),
});

export const snoozePolicySchema = z.object({
  snoozedUntil: z.coerce.date(),
  reason: z.string().trim().optional().default(''),
});

export const deactivatePolicySchema = z.object({
  reason: z.string().trim().optional().default(''),
});

export const archivePolicySchema = z.object({
  reason: z.string().trim().optional().default(''),
});

