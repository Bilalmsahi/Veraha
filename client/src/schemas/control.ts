/**
 * Control schemas - mirrors server validators
 */

import { z } from 'zod';

const MANUAL_STATUS = ['PASS', 'FAIL', 'NOT_APPLICABLE'] as const;
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

export const updateControlSchema = z.object({
  manualStatus: z.enum(MANUAL_STATUS).optional(),
  ownerId: objectIdSchema.nullable().optional(),
  implementationNotes: z.string().max(2000).optional(),
  nextAssessmentDue: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
  isPurchased: z.boolean().optional(),
});

export const assessControlSchema = z.object({
  status: z.enum(MANUAL_STATUS),
  notes: z.string().max(2000).optional(),
});

export type UpdateControlInput = z.infer<typeof updateControlSchema>;
export type AssessControlInput = z.infer<typeof assessControlSchema>;
