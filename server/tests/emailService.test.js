import { jest } from '@jest/globals';

import { sendEmail } from '../src/services/emailService.js';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...originalEnv };
  process.env.ZEPTOMAIL_API_KEY = 'test-api-key';
  process.env.EMAIL_REQUEST_TIMEOUT_MS = '1000';
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
});

function emailInput() {
  return {
    to: 'user@example.com',
    subject: 'Test email',
    text: 'Hello',
  };
}

test('classifies nested fetch DNS failures from ZeptoMail as DNS failures', async () => {
  const error = new TypeError('fetch failed');
  error.cause = { code: 'EAI_AGAIN', hostname: 'api.zeptomail.com' };
  global.fetch.mockRejectedValue(error);

  const result = await sendEmail(emailInput());

  expect(result.success).toBe(false);
  expect(result.errorCode).toBe('EAI_AGAIN');
  expect(result.error).toContain('DNS resolution failed');
  expect(result.serviceUnavailable).toBe(true);
});

test('attaches a timeout signal to live ZeptoMail requests', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'accepted' }),
  });

  const result = await sendEmail(emailInput());

  expect(result.success).toBe(true);
  expect(global.fetch).toHaveBeenCalledWith(
    'https://api.zeptomail.com/v1.1/email',
    expect.objectContaining({
      method: 'POST',
      signal: expect.any(AbortSignal),
    }),
  );
});

test('does not call ZeptoMail when API key is missing', async () => {
  delete process.env.ZEPTOMAIL_API_KEY;

  const result = await sendEmail(emailInput());

  expect(result.success).toBe(true);
  expect(result.testMode).toBe(true);
  expect(global.fetch).not.toHaveBeenCalled();
});
