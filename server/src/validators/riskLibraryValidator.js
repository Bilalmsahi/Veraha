import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

export const listRiskLibraryQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  search: z.string().optional(),
});

export const createRiskTemplateSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(300),
  description: z.string().max(2000).optional(),
  categoryNames: z.array(z.string().max(100)).optional(),
});

export const updateRiskTemplateSchema = z.object({
  title: z.string().min(2).max(300).optional(),
  description: z.string().max(2000).optional(),
  categoryNames: z.array(z.string().max(100)).optional(),
});

export const riskTemplateIdParamSchema = z.object({
  id: objectIdSchema,
});

export default {
  listRiskLibraryQuerySchema,
  createRiskTemplateSchema,
  updateRiskTemplateSchema,
  riskTemplateIdParamSchema,
};
