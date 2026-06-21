import { z } from 'zod';
import { objectIdSchema } from './commonValidator.js';

export const auditRequestParamsSchema = z.object({
  auditId: objectIdSchema,
  requestId: objectIdSchema,
});

export const evidenceRequestMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required'),
  attachmentUrl: z.string().trim().url().optional().or(z.literal('')),
});

export const updateEvidenceRequestSchema = z
  .object({
    dueDate: z.coerce.date().optional().nullable(),
    assignedTo: objectIdSchema.optional().nullable(),
    status: z.enum(['OPEN', 'IN_REVIEW', 'SUBMITTED', 'ACCEPTED', 'COMPLETED', 'CLOSED']).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export const submitEvidenceItemSchema = z.object({
  itemId: objectIdSchema,
});

export const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});

export default {
  auditRequestParamsSchema,
  evidenceRequestMessageSchema,
  updateEvidenceRequestSchema,
  submitEvidenceItemSchema,
  notificationIdParamSchema,
};
