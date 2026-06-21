/**
 * Template Validators (Zod Schemas)
 * Validation schemas for global control template endpoints.
 */

import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

/**
 * Template list query parameters
 * Extends pagination with template-specific filters
 */
export const templateQuerySchema = paginationSchema.extend({
  controlGroup: z.string().optional(),
  frameworkCode: z.string().transform(val => val?.toUpperCase()).optional(),
  search: z.string().optional(),
});

/**
 * Single template ID parameter
 */
export const templateIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Framework code parameter for by-framework endpoint
 */
export const frameworkCodeParamSchema = z.object({
  code: z.string().min(2).max(20).transform(val => val.toUpperCase()),
});

export default {
  templateQuerySchema,
  templateIdParamSchema,
  frameworkCodeParamSchema,
};
