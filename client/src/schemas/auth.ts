import { z } from 'zod';

const emailField = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .transform((s) => s.toLowerCase().trim());

const passwordField = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    'Password must contain: uppercase, lowercase, number, and special character (@$!%*?&)'
  );

const firstNameField = z
  .string()
  .min(1, 'First name is required')
  .max(50, 'First name too long')
  .transform((s) => s.trim());

const lastNameField = z
  .string()
  .min(1, 'Last name is required')
  .max(50, 'Last name too long')
  .transform((s) => s.trim());

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name too long')
    .transform((s) => s.trim()),
  email: emailField,
  password: passwordField,
  firstName: firstNameField,
  lastName: lastNameField,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordField,
  confirmPassword: passwordField,
  firstName: firstNameField.optional(),
  lastName: lastNameField.optional(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordField,
});

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(['MANAGER', 'EMPLOYEE', 'AUDITOR']),
  firstName: firstNameField,
  lastName: lastNameField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
