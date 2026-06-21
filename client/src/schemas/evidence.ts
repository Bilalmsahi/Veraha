/**
 * Evidence schemas - mirrors server validators
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

export const createEvidenceSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().max(2000).optional(),
    category: z.string().max(100).optional(),
    tags: z.union([z.string().transform((v) => v.split(',').map((t) => t.trim()).filter(Boolean)), z.array(z.string())]).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    linkedControlIds: z
      .union([
        z.string().transform((v) => v.split(',').map((id) => id.trim()).filter(Boolean)),
        z.array(objectIdSchema),
      ])
      .optional(),
  })
  .refine(
    (data) => !data.validUntil || !data.validFrom || data.validUntil > data.validFrom,
    { message: 'Valid until must be after valid from', path: ['validUntil'] }
  );

export const updateEvidenceSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  isSensitive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  linkedControlIds: z.array(objectIdSchema).optional(),
});

export const reviewEvidenceSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional(),
});

export const linkControlsSchema = z.object({
  controlIds: z.array(objectIdSchema).min(1, 'Select at least one control'),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;
export type ReviewEvidenceInput = z.infer<typeof reviewEvidenceSchema>;
export type LinkControlsInput = z.infer<typeof linkControlsSchema>;
