import { z } from 'zod';
import { objectIdSchema } from './commonValidator.js';

export const auditIdParamSchema = z.object({
  auditId: objectIdSchema,
});

export const auditFindingParamsSchema = z.object({
  auditId: objectIdSchema,
  findingId: objectIdSchema,
});

export const listAuditFindingsQuerySchema = z.object({
  status: z.enum(['OPEN', 'REMEDIATED', 'ACCEPTED_RISK']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const createAuditFindingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional().default(''),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  linkedControl: objectIdSchema.optional().nullable(),
});

export const updateAuditFindingSchema = z
  .object({
    status: z.enum(['OPEN', 'REMEDIATED', 'ACCEPTED_RISK']).optional(),
    remediationNote: z.string().trim().optional(),
  })
  .refine((data) => data.status !== undefined || data.remediationNote !== undefined, {
    message: 'At least one field is required',
  });

export default {
  auditIdParamSchema,
  auditFindingParamsSchema,
  listAuditFindingsQuerySchema,
  createAuditFindingSchema,
  updateAuditFindingSchema,
};
