/**
 * Risk schemas - mirrors server validators
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

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
  treatment: z.enum(['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID']).nullable().optional(),
  treatmentPlan: z.string().max(2000).optional(),
  ownerId: objectIdSchema.optional(),
  mitigatingControlIds: z.array(objectIdSchema).optional(),
  nextReviewDue: z.coerce.date().optional(),
});

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
  treatment: z.enum(['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID']).nullable().optional(),
  treatmentPlan: z.string().max(2000).optional(),
  ownerId: objectIdSchema.nullable().optional(),
  mitigatingControlIds: z.array(objectIdSchema).optional(),
  nextReviewDue: z.coerce.date().nullable().optional(),
});

export const closeRiskSchema = z.object({
  closureReason: z.string().min(10).max(1000),
});

export const linkControlsSchema = z.object({
  controlIds: z.array(objectIdSchema).min(1),
});

export const reopenRiskSchema = z.object({
  reason: z.string().min(10).max(1000).optional(),
});

export const reviewRiskSchema = z.object({
  likelihood: z.coerce.number().int().min(1).max(3).nullable().optional(),
  impact: z.coerce.number().int().min(1).max(3).nullable().optional(),
  notes: z.string().max(2000).optional(),
  nextReviewDue: z.coerce.date().optional(),
});

export const submitRiskApprovalSchema = z.object({
  approverIds: z.array(objectIdSchema).min(1),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
export type CloseRiskInput = z.infer<typeof closeRiskSchema>;
export type LinkControlsInput = z.infer<typeof linkControlsSchema>;
export type ReopenRiskInput = z.infer<typeof reopenRiskSchema>;
export type ReviewRiskInput = z.infer<typeof reviewRiskSchema>;
export type SubmitRiskApprovalInput = z.infer<typeof submitRiskApprovalSchema>;
