import { z } from 'zod';

export const groupIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  description: z.string().trim().optional().default(''),
  memberUserIds: z.array(z.string().min(1)).optional().default([]),
  personnelTaskSetId: z.string().min(1).nullable().optional(),
  type: z
    .enum([
      'ALL_PERSONNEL',
      'BOARD_MEMBERS',
      'ISMS_BODY',
      'GENERAL_STAFF',
      'ENGINEERING_TEAM',
      'HR_TEAM',
      'CUSTOM',
    ])
    .optional()
    .default('CUSTOM'),
});

export const updateGroupSchema = createGroupSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field is required',
});

export const listGroupsQuerySchema = z.object({
  type: z.string().optional(),
  search: z.string().optional(),
});

export const membersBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

