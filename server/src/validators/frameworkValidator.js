/**
 * Framework Validators (Zod Schemas)
 * Validation schemas for framework-related endpoints.
 */

import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

/**
 * Framework code parameter validation
 * Accepts: SOC2, ISO27001, HIPAA, GDPR (case-insensitive)
 */
export const frameworkCodeParamSchema = z.object({
  code: z.string().min(2).max(20).transform(val => val.toUpperCase()),
});

/**
 * Requirements query parameters
 * Extends pagination with framework-specific filters.
 * Override limit max to 500 for grouped view (all requirements by domain).
 */
export const requirementsQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().min(1).max(500).default(20),
  categoryId: objectIdSchema.optional(),
  search: z.string().optional(),
});

/**
 * Single requirement ID parameter
 */
export const requirementIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid requirement ID'),
});

/**
 * GET /frameworks/:code/requirements/:reqId — framework code + requirement ObjectId
 */
export const frameworkRequirementParamSchema = frameworkCodeParamSchema.merge(
  z.object({ reqId: objectIdSchema })
);

export default {
  frameworkCodeParamSchema,
  requirementsQuerySchema,
  requirementIdParamSchema,
  frameworkRequirementParamSchema,
};
