/**
 * Test validators (Zod)
 */
import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './commonValidator.js';
import {
  TEST_CATEGORY,
  TEST_TYPE,
  TEST_ROLLOUT,
  TEST_STATUS,
} from '../models/enums.js';

const categoryEnum = z.enum(TEST_CATEGORY);
const typeEnum = z.enum(TEST_TYPE);
const rolloutEnum = z.enum(TEST_ROLLOUT);
const statusEnum = z.enum(TEST_STATUS);

export const testIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listTestsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  category: categoryEnum.optional(),
  type: typeEnum.optional(),
  status: statusEnum.optional(),
  rollout: rolloutEnum.optional(),
  ownerId: objectIdSchema.optional(),
  frameworkId: objectIdSchema.optional(),
  controlId: objectIdSchema.optional(),
  /** Matches automationConfig.provider (substring) */
  integration: z.string().optional(),
  showInactive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  sortBy: z.enum(['name', 'dueDate', 'status', 'createdAt']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const updateTestSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    description: z.string().max(20000).optional(),
    instructions: z.string().max(20000).optional(),
    evidenceGuidance: z.string().max(20000).optional(),
    category: categoryEnum.optional(),
    type: typeEnum.optional(),
    renewalPeriod: z.enum(['annually', 'quarterly', 'monthly', 'once']).optional().nullable(),
    rollout: rolloutEnum.optional(),
    ownerId: objectIdSchema.optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    linkedControlIds: z.array(objectIdSchema).optional(),
    automationConfig: z
      .object({
        provider: z.string().optional(),
        integrationId: z.string().optional(),
        checkType: z.string().optional(),
        parameters: z.unknown().optional(),
        lastRunAt: z.coerce.date().optional().nullable(),
        nextRunAt: z.coerce.date().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .strict();

export const snoozeTestSchema = z.object({
  snoozedUntil: z.coerce.date(),
});

export const testCommentBodySchema = z.object({
  content: z.string().min(1).max(10000).trim(),
});
