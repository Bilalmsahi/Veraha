/**
 * Authentication & Authorization Middleware
 * 
 * SECURITY FIX: Correctly handles AUDITOR as a READ-ONLY role.
 * AUDITOR is NOT part of the numeric hierarchy - it's a special case.
 * 
 * Role Hierarchy (for write operations):
 *   EMPLOYEE < MANAGER < ADMIN
 * 
 * AUDITOR: Read-only access to everything (cannot write/delete)
 */

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { sendError } from './responseHandler.js';
import { requireOrg } from './requireOrg.js';
import { getSessionTimeoutMinutes, isSessionExpired } from '../utils/sessionTimeout.js';



// =============================================================================
// ROLE CONSTANTS
// =============================================================================

/**
 * Role hierarchy for WRITE operations
 * AUDITOR is not included - it's always read-only
 */
const WRITE_ROLE_LEVELS = {
    EMPLOYEE: 0,
    MANAGER: 1,
    ADMIN: 2,
};

/**
 * All valid roles
 */
const ALL_ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN', 'AUDITOR'];

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

/**
 * Protect routes - verify JWT and attach user to request
 * Also checks if user is soft-deleted
 */
export const protect = async (req, res, next) => {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return sendError(res, 401, 'Not authorized - no token provided');
    }

    try {
        // Use environment variable or development fallback
        const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' 
            ? 'dev-secret-key-change-in-production-min-32-chars!'
            : null);
        
        if (!jwtSecret) {
            console.error('[Auth] JWT_SECRET not configured');
            return sendError(res, 500, 'Server authentication error');
        }

        const decoded = jwt.verify(token, jwtSecret);

        // Lazy-load User model to avoid circular imports
        const User = mongoose.model('User');

        // Find user and EXPLICITLY check if deleted
        // This prevents soft-deleted users from authenticating
        const user = await User.findOne({
            _id: decoded.id || decoded.userId,
            isDeleted: false,
        });

        if (!user) {
            return sendError(res, 401, 'User no longer exists or has been disabled');
        }

        const Organization = mongoose.model('Organization');
        const organization = await Organization.findById(user.organizationId)
            .select('settings.sessionTimeoutMinutes status')
            .lean();
        if (organization?.status === 'suspended') {
            return sendError(res, 403, 'Organization is suspended. Please contact support.');
        }
        const sessionTimeoutMinutes = getSessionTimeoutMinutes(organization);

        if (isSessionExpired(user, Date.now(), sessionTimeoutMinutes)) {
            return sendError(res, 401, 'Session expired due to inactivity', { reason: 'session_timeout' });
        }

        // Attach user to request
        req.user = user;

        const lastActivityAt = user.lastActivityAt ? user.lastActivityAt.getTime() : 0;
        if (Date.now() - lastActivityAt > 5 * 60 * 1000) {
            User.updateOne({ _id: user._id }, { $set: { lastActivityAt: new Date() } }).catch((err) => {
                console.error('[Auth] Failed to update user activity:', err.message);
            });
        }

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return sendError(res, 401, 'Token expired - please log in again');
        }
        if (error.name === 'JsonWebTokenError') {
            return sendError(res, 401, 'Invalid token');
        }
        return sendError(res, 401, 'Not authorized');
    }
};

/**
 * Optional auth - attach user when a valid Bearer token is present, but allow
 * public reads to continue without a token.
 */
export const optionalAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next();
    }

    try {
        const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production'
            ? 'dev-secret-key-change-in-production-min-32-chars!'
            : null);

        if (!jwtSecret) {
            console.error('[Auth] JWT_SECRET not configured');
            return sendError(res, 500, 'Server authentication error');
        }

        const decoded = jwt.verify(token, jwtSecret);
        const User = mongoose.model('User');
        const user = await User.findOne({
            _id: decoded.id || decoded.userId,
            isDeleted: false,
        });

        if (user) {
            req.user = user;
        }
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return sendError(res, 401, 'Token expired - please log in again');
        }
        if (error.name === 'JsonWebTokenError') {
            return sendError(res, 401, 'Invalid token');
        }
        return sendError(res, 401, 'Not authorized');
    }
};

/**
 * Alias for protect (clearer intent in route definitions)
 */
export const requireAuth = protect;

// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================

/**
 * Authorize specific roles
 * 
 * SECURITY: ADMIN can access everything.
 * For other roles, they must be explicitly listed.
 * AUDITOR only gets access if explicitly listed.
 * 
 * Usage:
 *   router.get('/reports', protect, authorize('ADMIN', 'MANAGER', 'AUDITOR'), handler);
 *   router.delete('/controls/:id', protect, authorize('ADMIN'), handler);
 */
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 401, 'Authentication required');
        }

        const userRole = req.user.role;

        // ADMIN can always access everything
        if (userRole === 'ADMIN') {
            return next();
        }

        // Check if user's role is in the allowed list
        if (!allowedRoles.includes(userRole)) {
            return sendError(res, 403, `Role '${userRole}' is not authorized for this action`, {
                allowed: allowedRoles,
                current: userRole,
            });
        }

        next();
    };
};

/**
 * Block AUDITOR from write operations
 * Use this on POST/PUT/PATCH/DELETE routes
 * 
 * Usage:
 *   router.post('/controls', protect, blockAuditor, handler);
 */
export const blockAuditor = (req, res, next) => {
    if (!req.user) {
        return sendError(res, 401, 'Authentication required');
    }

    if (req.user.role === 'AUDITOR') {
        return sendError(res, 403, 'Auditors have read-only access');
    }

    next();
};

/**
 * Require minimum role level for WRITE operations
 * AUDITOR is always rejected (read-only)
 * 
 * Usage:
 *   router.put('/controls/:id', protect, requireMinRole('MANAGER'), handler);
 */
export const requireMinRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 401, 'Authentication required');
        }

        const userRole = req.user.role;

        // AUDITOR is NEVER allowed for write operations
        if (userRole === 'AUDITOR') {
            return sendError(res, 403, 'Auditors have read-only access');
        }

        const userLevel = WRITE_ROLE_LEVELS[userRole];
        const requiredLevel = WRITE_ROLE_LEVELS[minRole];

        // Unknown role - reject
        if (userLevel === undefined) {
            return sendError(res, 403, `Unknown role: ${userRole}`);
        }

        if (userLevel < requiredLevel) {
            return sendError(res, 403, `Insufficient permissions. Required: ${minRole} or higher`, {
                required: minRole,
                current: userRole,
            });
        }

        next();
    };
};

// =============================================================================
// ORGANIZATION AUTHORIZATION
// =============================================================================

/**
 * Verify user belongs to the organization in the request
 * Checks params, body, and query for organizationId
 */
export const authorizeOrg = (req, res, next) => {
    if (!req.user) {
        return sendError(res, 401, 'Authentication required');
    }

    const orgId = req.params.organizationId || req.body.organizationId || req.query.organizationId;

    if (orgId) {
        const userOrgId = req.user.organizationId?.toString();
        const targetOrgId = orgId.toString();

        if (userOrgId !== targetOrgId) {
            return sendError(res, 403, 'Access denied to this organization');
        }
    }

    next();
};

/**
 * Inject organizationId filter into request
 * Useful for list endpoints
 */
export const injectOrgFilter = (req, res, next) => {
    if (!req.user) {
        return sendError(res, 401, 'Authentication required');
    }

    // Attach filter for use in controllers
    req.orgFilter = { organizationId: req.user.organizationId };

    next();
};

export const requireInternalUser = (req, res, next) => {
    if (!req.user) {
        return sendError(res, 401, 'Authentication required');
    }

    if (req.user.role === 'AUDITOR') {
        return sendError(res, 403, 'Auditors must use the auditor portal');
    }

    return requireOrg(req, res, next);
};

export const requireAuditorScope = (paramName = 'auditId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return sendError(res, 401, 'Authentication required');
        }

        if (req.user.role !== 'AUDITOR') {
            return sendError(res, 403, 'Auditor access required');
        }

        const auditId = req.params[paramName] || req.params.id || req.body.auditId || req.query.auditId;
        if (!auditId) {
            return sendError(res, 400, 'Audit ID is required');
        }

        try {
            const AuditAssignment = mongoose.model('AuditAssignment');
            const Audit = mongoose.model('Audit');
            const AuditorProfile = mongoose.model('AuditorProfile');
            const auditorProfile = await AuditorProfile.findOne({
                email: req.user.email?.toLowerCase().trim(),
            });

            if (!auditorProfile) {
                return sendError(res, 403, 'Auditor profile not found');
            }

            const assignment = await AuditAssignment.findOne({
                auditId,
                auditorProfile: auditorProfile._id,
                status: 'ACTIVE',
                isDeleted: { $ne: true },
            }).lean();

            if (!assignment) {
                return sendError(res, 403, 'You are not assigned to this audit');
            }

            const audit = await Audit.findOne({
                _id: auditId,
                organizationId: assignment.organizationId,
                isDeleted: { $ne: true },
            }).lean();

            if (!audit || audit.status === 'ARCHIVED') {
                return sendError(res, 403, 'Auditor access is not active for this audit');
            }

            // COMPLETED audits are read-only — block write operations but allow GET
            if (audit.status === 'COMPLETED' && req.method !== 'GET') {
                return sendError(res, 403, 'This audit is completed and no longer accepts changes');
            }

            const now = new Date();
            if (assignment.accessStartsAt && new Date(assignment.accessStartsAt) > now) {
                return sendError(res, 403, 'Auditor access has not started');
            }
            if (assignment.accessEndsAt && new Date(assignment.accessEndsAt) < now) {
                return sendError(res, 403, 'Auditor access has expired');
            }

            req.auditAssignment = assignment;
            req.audit = audit;
            req.auditOrgId = assignment.organizationId;
            req.auditorProfile = auditorProfile;
            return next();
        } catch (error) {
            return next(error);
        }
    };
};

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    protect,
    optionalAuth,
    requireAuth,
    authorize,
    blockAuditor,
    requireMinRole,
    requireInternalUser,
    requireAuditorScope,
    authorizeOrg,
    injectOrgFilter,
};
