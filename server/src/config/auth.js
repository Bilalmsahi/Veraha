export const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || process.env.JWT_EXPIRES_IN || '24h';
export const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

const EXPIRY_IN_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const expiryToMilliseconds = (expiry) => {
  const match = /^(\d+)([mhd])$/.exec(expiry);
  if (!match) {
    throw new Error(`Unsupported token expiry: ${expiry}`);
  }

  return Number(match[1]) * EXPIRY_IN_MS[match[2]];
};

export const getJwtSecret = () => {
  const jwtSecret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? 'dev-secret-key-change-in-production-min-32-chars!'
      : null);

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwtSecret;
};

export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: expiryToMilliseconds(REFRESH_TOKEN_EXPIRY),
  path: '/api/v1/auth',
});
