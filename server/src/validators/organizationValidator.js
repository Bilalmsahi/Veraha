/**
 * Organization Validators (Zod Schemas)
 * Validation schemas for organization-related endpoints.
 */

import { z } from 'zod';
import { ALLOWED_SESSION_TIMEOUT_MINUTES } from '../utils/sessionTimeout.js';

// Valid framework codes
const FRAMEWORK_CODES = ['SOC2', 'ISO27001', 'HIPAA', 'GDPR'];

/**
 * Update organization settings schema
 * Used for PATCH /organization
 */
export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.object({
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    evidenceExpiryWarningDays: z.number().min(1).max(365).optional(),
    sessionTimeoutMinutes: z
      .number()
      .int('Session timeout must be a whole number')
      .refine(
        (value) => ALLOWED_SESSION_TIMEOUT_MINUTES.includes(value),
        'Invalid session timeout duration',
      )
      .optional(),
  }).optional(),
});

/**
 * Toggle frameworks schema
 * Used for PATCH /organization/frameworks
 */
export const toggleFrameworksSchema = z.object({
  enable: z.array(z.enum(FRAMEWORK_CODES)).optional(),
  disable: z.array(z.enum(FRAMEWORK_CODES)).optional(),
}).refine(data => data.enable?.length || data.disable?.length, {
  message: 'Must specify frameworks to enable or disable',
});

export default {
  updateOrgSchema,
  toggleFrameworksSchema,
};
