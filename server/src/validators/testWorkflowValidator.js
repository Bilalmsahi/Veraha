import { z } from 'zod';

export const testIdParamSchema = z.object({
  id: z.string().min(1),
});

export const snoozeSchema = z.object({
  snoozedUntil: z.coerce.date(),
  reason: z.string().trim().optional().default(''),
});

export const workflowReasonSchema = z.object({
  reason: z.string().trim().optional().default(''),
}).default({});

