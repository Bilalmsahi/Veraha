/**
 * Common Validators (Zod Schemas)
 * Reusable validation schemas for pagination, ObjectIds, etc.
 */

import { z } from 'zod';

/**
 * MongoDB ObjectId validation
 */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const objectIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Reusable pagination schema
 * Apply to any GET list endpoint
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export default {
  objectIdSchema,
  objectIdParamSchema,
  paginationSchema,
};
