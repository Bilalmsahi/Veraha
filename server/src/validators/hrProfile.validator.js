/**
 * HR Profile Validators
 * Zod schemas for HR Profile API endpoints
 */
import { z } from 'zod';
import { paginationSchema, objectIdSchema } from './commonValidator.js';

const EMPLOYMENT_STATUS = ['active', 'on_leave', 'departed'];
const HR_SOURCE = ['manual', 'bamboohr_import', 'rippling_import'];
const BACKGROUND_CHECK_STATUS = ['pending', 'completed', 'not_required', 'failed'];

// =============================================================================
// HR PROFILE SCHEMAS
// =============================================================================

/**
 * Create HR profile schema
 */
export const createHrProfileSchema = z.object({
  fullName: z.string().min(1).max(300),
  workEmail: z.string().email(),
  employeeNumber: z.string().max(100).optional(),
  department: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  managerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid manager ID').optional().nullable(),
  employmentStatus: z.enum(EMPLOYMENT_STATUS).optional().default('active'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional().nullable(),
  hrSource: z.enum(HR_SOURCE).optional().default('manual'),
  backgroundCheckStatus: z.enum(BACKGROUND_CHECK_STATUS).optional().default('not_required'),
});

/**
 * Update HR profile schema
 */
export const updateHrProfileSchema = createHrProfileSchema.partial();

/**
 * Depart HR profile schema
 */
export const departSchema = z.object({
  endDate: z.coerce.date().optional(),
});

/**
 * Import CSV schema
 */
export const importCSVSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1),
  hrSource: z.enum(HR_SOURCE).default('manual'),
});

/**
 * List HR profiles query schema
 */
export const listHrProfilesQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const hrProfileIdParamSchema = z.object({
  id: objectIdSchema,
});

export const hrProfileControlParamSchema = z.object({
  id: objectIdSchema,
  controlId: objectIdSchema,
});

export default {
  createHrProfileSchema,
  updateHrProfileSchema,
  departSchema,
  importCSVSchema,
  listHrProfilesQuerySchema,
  hrProfileIdParamSchema,
  hrProfileControlParamSchema,
};
