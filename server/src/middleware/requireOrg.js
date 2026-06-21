import { sendError } from './responseHandler.js';

export const requireOrg = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }

  const orgId = req.user.organizationId || req.user.organization;

  if (!orgId) {
    return sendError(res, 403, 'Organization context required');
  }

  req.orgId = orgId;
  return next();
};

export default requireOrg;
