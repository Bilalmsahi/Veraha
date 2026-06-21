import { verifyAdminToken } from './adminAuth.js';

export function requireSuperAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!verifyAdminToken(authHeader.slice(7))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}
