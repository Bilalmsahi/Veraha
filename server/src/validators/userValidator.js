import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';
import { ROLE } from '../models/enums.js';

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(ROLE),
});

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});

export default {
  listUsersQuerySchema,
  updateRoleSchema,
  userIdParamSchema,
};
