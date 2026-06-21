import { z } from 'zod';
import { ALLOWED_SESSION_TIMEOUT_MINUTES } from '../utils/sessionTimeout.js';

export const updateUserSettingsSchema = z.object({
    sessionTimeoutMinutes: z
        .number({ required_error: 'Session timeout is required' })
        .int('Session timeout must be a whole number')
        .refine(
            (value) => ALLOWED_SESSION_TIMEOUT_MINUTES.includes(value),
            'Invalid session timeout duration',
        ),
});
