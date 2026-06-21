/**
 * Activity Log Service
 * 
 * Centralizes activity logging with error handling.
 * Ensures that log failures don't crash the main application.
 * 
 * Why:
 * - Direct calls to ActivityLog inside models can throw and break auth flows
 * - Unawaited log calls may leave audit gaps
 * - This service catches all errors and logs them without crashing
 */

import mongoose from 'mongoose';

/**
 * Safely log an activity to the ActivityLog collection.
 * Catches all errors and logs them to console instead of throwing.
 * 
 * @param {Object} params - Activity parameters
 * @param {ObjectId} params.organizationId - Organization ID
 * @param {ObjectId|null} params.actorId - User performing the action (null for system)
 * @param {Object} params.actorSnapshot - Denormalized actor info
 * @param {String} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {String} params.entityType - Type of entity affected
 * @param {ObjectId} params.entityId - ID of entity affected
 * @param {Object} params.entitySnapshot - Denormalized entity info
 * @param {Object} params.changes - Before/after state
 * @param {Object} params.metadata - Additional context
 * @param {String} params.notes - Optional notes
 * @returns {Promise<Document|null>} Created log or null if failed
 */
export async function logActivity({
    organizationId,
    actorId = null,
    actorSnapshot = {},
    action,
    entityType,
    entityId,
    entitySnapshot = {},
    changes = {},
    metadata = {},
    notes = '',
}) {
    try {
        // Lazy-load ActivityLog to avoid circular imports
        const ActivityLog = mongoose.model('ActivityLog');

        const log = await ActivityLog.create({
            organizationId,
            actorId,
            actorSnapshot,
            action,
            entityType,
            entityId,
            entitySnapshot,
            changes,
            timestamp: new Date(),
            metadata,
            notes,
        });

        return { success: true, log, error: null };
    } catch (error) {
        // Log to console but don't throw
        console.error('[ActivityLogService] Failed to log activity:', {
            action,
            entityType,
            entityId: entityId?.toString(),
            error: error.message,
        });

        // Return structured error so caller can check if needed
        return {
            success: false,
            log: null,
            error: error.message,
            timestamp: new Date(),
        };
    }
}

/**
 * Log a security event (login, password change, token generation)
 * @param {Object} params - Security event parameters
 */
export async function logSecurityEvent({
    organizationId,
    userId,
    userEmail,
    userName,
    userRole,
    eventType,
    details = {},
}) {
    return logActivity({
        organizationId,
        actorId: userId,
        actorSnapshot: {
            email: userEmail,
            name: userName,
            role: userRole,
        },
        action: 'UPDATE',
        entityType: 'User',
        entityId: userId,
        entitySnapshot: {
            title: userName,
            identifier: userEmail,
        },
        changes: {
            fields: [eventType],
        },
        metadata: {
            securityEvent: true,
            ...details,
        },
        notes: `Security event: ${eventType}`,
    });
}

/**
 * Log a CRUD operation
 * @param {Object} params - CRUD operation parameters
 */
export async function logCrudOperation({
    organizationId,
    actorId,
    actorSnapshot,
    action,
    entityType,
    entityId,
    entitySnapshot,
    before = null,
    after = null,
    changedFields = [],
}) {
    return logActivity({
        organizationId,
        actorId,
        actorSnapshot,
        action,
        entityType,
        entityId,
        entitySnapshot,
        changes: {
            before,
            after,
            fields: changedFields,
        },
    });
}

export default {
    logActivity,
    logSecurityEvent,
    logCrudOperation,
};
