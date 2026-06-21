/**
 * Vendor schemas - mirrors server validators
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

const contactSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
}).optional();

export const createVendorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  description: z.string().max(2000).optional(),
  serviceType: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  riskTier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED']).default('UNSCORED'),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  linkedControlIds: z.array(objectIdSchema).optional(),
  primaryContact: contactSchema,
  securityContact: contactSchema,
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  hasNda: z.boolean().default(false),
  hasDpa: z.boolean().default(false),
  hasSla: z.boolean().default(false),
  assessmentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY']).default('ANNUALLY'),
  nextAssessmentDate: z.coerce.date().optional(),
  ownerId: objectIdSchema.optional(),
  dataTypes: z.array(z.string()).optional(),
  dataShared: z.array(z.string()).optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  serviceType: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')).nullable(),
  riskTier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  linkedControlIds: z.array(objectIdSchema).optional(),
  primaryContact: contactSchema,
  securityContact: contactSchema,
  contractStartDate: z.coerce.date().optional().nullable(),
  contractEndDate: z.coerce.date().optional().nullable(),
  hasNda: z.boolean().optional(),
  hasDpa: z.boolean().optional(),
  hasSla: z.boolean().optional(),
  assessmentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY']).optional(),
  nextAssessmentDate: z.coerce.date().optional().nullable(),
  ownerId: objectIdSchema.nullable().optional(),
  dataTypes: z.array(z.string()).optional(),
  dataShared: z.array(z.string()).optional(),
});

export const recordAssessmentSchema = z.object({
  riskTier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED']).optional(),
  notes: z.string().max(2000).optional(),
  nextAssessmentDate: z.coerce.date().optional(),
});

export const addCertificationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  validUntil: z.coerce.date().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_REVIEW', 'TERMINATED']),
  reason: z.string().max(500).optional(),
});

export const linkControlsSchema = z.object({
  controlIds: z.array(objectIdSchema).min(1, 'Select at least one control'),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type RecordAssessmentInput = z.infer<typeof recordAssessmentSchema>;
export type AddCertificationInput = z.infer<typeof addCertificationSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type LinkControlsInput = z.infer<typeof linkControlsSchema>;
