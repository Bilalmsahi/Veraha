import { z } from 'zod';

const categories = [
  'Engineering',
  'Human resources',
  'Policy',
  'Risks',
  'Legal',
  'Finance',
  'Management',
  'Other',
] as const;

/** Matches server objectIdSchema — empty string allowed for "unassign owner" in forms */
const optionalObjectIdString = z.union([
  z.literal(''),
  z.string().regex(/^[a-f\d]{24}$/i),
]);

export const updateTestFormSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional(),
  instructions: z.string().max(20000).optional(),
  evidenceGuidance: z.string().max(20000).optional(),
  category: z.enum(categories).optional(),
  type: z.enum(['document', 'automated']).optional(),
  renewalPeriod: z.enum(['annually', 'quarterly', 'monthly', 'once']).nullable().optional(),
  rollout: z.enum(['enabled', 'disabled', 'monitor_only']).optional(),
  ownerId: z.union([z.null(), optionalObjectIdString]).optional(),
  dueDate: z.string().optional().nullable(),
  linkedControlIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
});

export type UpdateTestFormInput = z.infer<typeof updateTestFormSchema>;

export const snoozeTestFormSchema = z.object({
  snoozedUntil: z.string().min(1),
});

export type SnoozeTestFormInput = z.infer<typeof snoozeTestFormSchema>;
