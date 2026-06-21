import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const getAdminConfig = () => ({
  email: process.env.SUPER_ADMIN_EMAIL || '',
  password: process.env.SUPER_ADMIN_PASSWORD || '',
  secret: process.env.SUPER_ADMIN_SESSION_SECRET || process.env.JWT_SECRET || '',
});

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyAdminCredentials(email, password) {
  const config = getAdminConfig();
  if (!config.email || !config.password || !config.secret) return false;
  return safeEqual(email, config.email) && safeEqual(password, config.password);
}

export function signAdminToken() {
  const { secret, email } = getAdminConfig();
  return jwt.sign({ role: 'super_admin', email }, secret, { expiresIn: '8h' });
}

export function verifyAdminToken(token) {
  try {
    const { secret } = getAdminConfig();
    if (!secret) return false;
    const payload = jwt.verify(token, secret);
    return payload?.role === 'super_admin';
  } catch {
    return false;
  }
}
