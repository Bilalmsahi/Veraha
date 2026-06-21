import mongoose from 'mongoose';

/**
 * Tenant Plugin (Multi-tenancy & Soft Deletes)
 * 
 * Automatically applies:
 * 1. Soft Delete logic (filtering out deleted docs by default)
 * 2. Organization context helpers
 * 3. Static methods for soft delete operations
 * 4. Authorization helper methods
 * 
 * Usage:
 *   import tenantPlugin from './plugins/tenantPlugin.js';
 *   mySchema.plugin(tenantPlugin);
 */
export default function tenantPlugin(schema, options = {}) {
  // ==========================================================================
  // 1. SOFT DELETE MIDDLEWARE
  // Filter out deleted docs from standard queries by default
  // ==========================================================================

  // Mongoose 9.x compatible - using async middleware (no next needed)
  const softDeleteMiddleware = async function () {
    // ✅ Use getOptions() to check flag without mutation
    const options = this.getOptions();
    const includeDeleted = options.includeDeleted;

    // Only filter if explicitly not including deleted
    if (includeDeleted !== true) {
      this.where({ isDeleted: { $ne: true } });
    }
  };

  schema.pre('find', softDeleteMiddleware);
  schema.pre('findOne', softDeleteMiddleware);
  schema.pre('countDocuments', softDeleteMiddleware);
  schema.pre('findOneAndUpdate', softDeleteMiddleware);

  // ==========================================================================
  // 2. STATIC METHODS - Basic Soft Delete
  // ==========================================================================

  /**
   * Soft delete a document by ID
   * @param {ObjectId} id - Document ID to soft delete
   * @param {ObjectId} userId - User performing the deletion
   * @returns {Promise<Document>} Updated document
   */
  schema.statics.softDelete = async function (id, userId) {
    return this.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
      { new: true }
    );
  };

  /**
   * Soft delete multiple documents matching a query
   * @param {Object} filter - Query filter
   * @param {ObjectId} userId - User performing the deletion
   * @returns {Promise<UpdateResult>} MongoDB update result
   */
  schema.statics.softDeleteMany = async function (filter, userId) {
    return this.updateMany(filter, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    });
  };

  /**
   * Find documents including soft-deleted ones
   * @param {Object} query - Query filter
   * @returns {Query} Mongoose query
   */
  schema.statics.findWithDeleted = function (query = {}) {
    return this.find(query).setOptions({ includeDeleted: true });
  };

  /**
   * Find one document including soft-deleted ones
   * @param {Object} query - Query filter
   * @returns {Query} Mongoose query
   */
  schema.statics.findOneWithDeleted = function (query = {}) {
    return this.findOne(query).setOptions({ includeDeleted: true });
  };

  /**
   * Find only soft-deleted documents
   * @param {Object} query - Additional query filter
   * @returns {Query} Mongoose query
   */
  schema.statics.findDeleted = function (query = {}) {
    return this.find({ ...query, isDeleted: true }).setOptions({ includeDeleted: true });
  };

  /**
   * Restore a soft-deleted document by ID
   * @param {ObjectId} id - Document ID to restore
   * @returns {Promise<Document>} Updated document
   */
  schema.statics.restore = async function (id) {
    return this.findOneAndUpdate(
      { _id: id, includeDeleted: true },
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
      { new: true }
    ).setOptions({ includeDeleted: true });
  };

  /**
   * Restore multiple soft-deleted documents
   * @param {Object} filter - Query filter
   * @returns {Promise<UpdateResult>} MongoDB update result
   */
  schema.statics.restoreMany = async function (filter) {
    return this.updateMany(
      { ...filter, isDeleted: true },
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      }
    ).setOptions({ includeDeleted: true });
  };

  /**
   * Hard delete (permanently remove) a soft-deleted document
   * Only works on already soft-deleted documents for safety
   * 
   * IMPORTANT: Should only be used by ADMIN role with explicit confirmation
   * 
   * @param {ObjectId} id - Document ID to permanently delete
   * @param {ObjectId} userId - User performing hard delete
   * @param {String} reason - Reason for hard delete (required for audit)
   * @returns {Promise<Object>} { deleted: Document, activityLogId }
   */
  schema.statics.hardDelete = async function (id, userId, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the document first (must be soft-deleted)
      const doc = await this.findOne({ _id: id, isDeleted: true })
        .setOptions({ includeDeleted: true })
        .session(session);

      if (!doc) {
        throw new Error('Document not found or not soft-deleted');
      }

      // Log before deletion (immutable audit trail)
      const ActivityLog = mongoose.model('ActivityLog');
      const activityLog = await ActivityLog.create([{
        organizationId: doc.organizationId,
        actorId: userId,
        action: 'DELETE',
        entityType: this.modelName,
        entityId: doc._id,
        entitySnapshot: {
          title: doc.title || doc.name,
          identifier: doc.identifier,
        },
        timestamp: new Date(),
        notes: `Hard delete: ${reason || 'No reason provided'}`,
        metadata: {
          hardDelete: true,
          reason,
        },
      }], { session });

      // Permanently delete
      const deleted = await this.findOneAndDelete({ _id: id, isDeleted: true })
        .setOptions({ includeDeleted: true })
        .session(session);

      await session.commitTransaction();

      return {
        deleted,
        activityLogId: activityLog[0]._id,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  };

  // ==========================================================================
  // 3. STATIC METHODS - Authorization Helpers
  // ==========================================================================

  /**
   * Find with authorization (auto-filters by user's organization)
   * 
   * @param {Object} user - Authenticated user { _id, organizationId, role }
   * @param {Object} query - Query filter
   * @param {Object} options - { includeDeleted: boolean }
   * @returns {Query} Mongoose query
   */
  schema.statics.findAuthorized = function (user, query = {}, options = {}) {
    if (!user || !user.organizationId) {
      throw new Error('User authentication required');
    }

    // Add organization filter
    const authorizedQuery = {
      ...query,
      organizationId: user.organizationId,
    };

    // Auditors can see deleted items if explicitly requested
    if (options.includeDeleted && user.role === 'AUDITOR') {
      authorizedQuery.includeDeleted = true;
    }

    return this.find(authorizedQuery);
  };

  /**
   * Find one with authorization
   * 
   * @param {Object} user - Authenticated user
   * @param {Object} query - Query filter
   * @returns {Query} Mongoose query
   */
  schema.statics.findOneAuthorized = function (user, query = {}) {
    if (!user || !user.organizationId) {
      throw new Error('User authentication required');
    }

    return this.findOne({
      ...query,
      organizationId: user.organizationId,
    });
  };

  /**
   * Find by ID with authorization check
   * 
   * @param {Object} user - Authenticated user
   * @param {ObjectId} id - Document ID
   * @returns {Promise<Document|null>}
   */
  schema.statics.findByIdAuthorized = async function (user, id) {
    if (!user || !user.organizationId) {
      throw new Error('User authentication required');
    }

    const doc = await this.findById(id);

    if (!doc) {
      return null;
    }

    // Check organization membership
    if (doc.organizationId && !doc.organizationId.equals(user.organizationId)) {
      throw new Error('Access denied: Document belongs to different organization');
    }

    return doc;
  };

  // ==========================================================================
  // 4. INSTANCE METHODS
  // ==========================================================================

  /**
   * Soft delete this document instance
   * @param {ObjectId} userId - User performing the deletion
   * @returns {Promise<Document>} Updated document
   */
  schema.methods.softDelete = async function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
  };

  /**
   * Restore this soft-deleted document instance
   * @returns {Promise<Document>} Updated document
   */
  schema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  // NOTE: canView, canModify, canDelete are provided by authorizationPlugin
  // Apply both plugins if you need the full feature set

  // ==========================================================================
  // 5. QUERY HELPERS
  // ==========================================================================

  /**
   * Include soft-deleted documents in query results
   * Usage: Model.find().withDeleted()
   */
  schema.query.withDeleted = function () {
    return this.setOptions({ includeDeleted: true });
  };

  /**
   * Filter by organization ID (multi-tenancy helper)
   * Usage: Model.find().forOrg(orgId)
   * @param {ObjectId} organizationId - Organization ID
   */
  schema.query.forOrg = function (organizationId) {
    return this.where({ organizationId });
  };

  /**
   * Filter to only deleted documents
   * Usage: Model.find().onlyDeleted()
   */
  schema.query.onlyDeleted = function () {
    return this.where({ isDeleted: true }).setOptions({ includeDeleted: true });
  };

  /**
   * Pagination helper
   * Usage: Model.find().paginate(page, limit)
   * @param {Number} page - Page number (1-indexed)
   * @param {Number} limit - Results per page
   */
  schema.query.paginate = function (page = 1, limit = 20) {
    return this.skip((page - 1) * limit).limit(limit);
  };
}

// =============================================================================
// ENHANCED SOFT DELETE WITH CASCADE
// =============================================================================

/**
 * Enhanced Soft Delete Plugin with Cascade Support
 * 
 * Automatically removes references from other models when soft-deleting
 * 
 * Usage:
 *   import { enhancedSoftDelete } from './plugins/tenantPlugin.js';
 *   
 *   mySchema.plugin(enhancedSoftDelete, {
 *     removeReferences: [
 *       { model: 'Evidence', field: 'linkedControlIds' },
 *       { model: 'Risk', field: 'mitigatingControlIds' }
 *     ]
 *   });
 */
export function enhancedSoftDelete(schema, cascadeConfig = {}) {
  const { removeReferences = [] } = cascadeConfig;

  /**
   * Soft delete with cascade handling
   * @param {ObjectId} id - Document ID to soft delete
   * @param {ObjectId} userId - User performing the deletion
   * @param {Object} options - { cascade: boolean, reason: string }
   * @returns {Promise<Document>} Updated document
   */
  schema.statics.softDeleteWithCascade = async function (id, userId, options = {}) {
    const { cascade = true, reason } = options;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Soft delete the document
      const doc = await this.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
        },
        { new: true, session }
      );

      if (!doc) {
        throw new Error('Document not found');
      }

      // Handle cascades if configured
      if (cascade && removeReferences.length > 0) {
        for (const { model: modelName, field } of removeReferences) {
          try {
            const Model = mongoose.model(modelName);

            const result = await Model.updateMany(
              { [field]: id },
              { $pull: { [field]: id } },
              { session }
            );

            console.log(`[Cascade] Removed ${id} from ${result.modifiedCount} ${modelName}.${field} references`);
          } catch (error) {
            console.error(`[Cascade Error] Failed to remove ${id} from ${modelName}.${field}:`, error.message);
            // Continue with other cascades even if one fails
          }
        }
      }

      // Log activity
      try {
        const ActivityLog = mongoose.model('ActivityLog');
        await ActivityLog.create([{
          organizationId: doc.organizationId,
          actorId: userId,
          action: 'DELETE',
          entityType: this.modelName,
          entityId: doc._id,
          entitySnapshot: {
            title: doc.title || doc.name,
            identifier: doc.identifier,
          },
          timestamp: new Date(),
          notes: reason || 'Soft deleted with cascade',
          metadata: {
            cascaded: cascade,
            referencesRemoved: removeReferences.map(r => `${r.model}.${r.field}`),
          },
        }], { session });
      } catch (error) {
        // Log error but don't fail the transaction
        console.error('[Activity Log Error]:', error.message);
      }

      await session.commitTransaction();
      return doc;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  };

  /**
   * Override default softDelete to use cascade version
   */
  schema.statics.softDelete = async function (id, userId, options = {}) {
    return this.softDeleteWithCascade(id, userId, options);
  };
}

// =============================================================================
// PAGINATION HELPER
// =============================================================================

/**
 * Pagination Helper Static Method
 * 
 * Returns paginated results with metadata
 * 
 * Usage:
 *   const result = await Model.paginate({ status: 'ACTIVE' }, { page: 1, limit: 20 });
 */
export function paginationPlugin(schema) {
  schema.statics.paginate = async function (filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      select,
      populate,
    } = options;

    const skip = (page - 1) * limit;

    // Build query
    let query = this.find(filter).sort(sort).skip(skip).limit(limit);

    if (select) {
      query = query.select(select);
    }

    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(p => {
          query = query.populate(p);
        });
      } else {
        query = query.populate(populate);
      }
    }

    // Execute query and count in parallel
    const [docs, total] = await Promise.all([
      query.exec(),
      this.countDocuments(filter),
    ]);

    return {
      docs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  };
}

// =============================================================================
// AUTHORIZATION PLUGIN
// =============================================================================

/**
 * Authorization Plugin
 * 
 * Adds authorization helper methods to schema
 * 
 * Usage:
 *   import { authorizationPlugin } from './plugins/tenantPlugin.js';
 *   mySchema.plugin(authorizationPlugin);
 */
export function authorizationPlugin(schema) {
  /**
   * Check if user can modify this document
   * @param {Object} user - Authenticated user with { _id, organizationId, role }
   * @returns {Boolean}
   */
  schema.methods.canModify = function (user) {
    if (!user) return false;

    // Check organization membership
    if (this.organizationId && !this.organizationId.equals(user.organizationId)) {
      return false;
    }

    // Auditors have read-only access
    if (user.role === 'AUDITOR') {
      return false;
    }

    // ADMIN and MANAGER can modify anything in their org
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true;
    }

    // EMPLOYEE can only modify if they're the owner
    if (this.ownerId && user._id) {
      return this.ownerId.equals(user._id);
    }

    // Default: no permission
    return false;
  };

  /**
   * Check if user can delete this document
   * @param {Object} user - Authenticated user
   * @returns {Boolean}
   */
  schema.methods.canDelete = function (user) {
    if (!user) return false;

    // Only ADMIN can delete
    if (user.role !== 'ADMIN') {
      return false;
    }

    // Check organization membership
    if (this.organizationId && !this.organizationId.equals(user.organizationId)) {
      return false;
    }

    return true;
  };

  /**
   * Check if user can view this document
   * @param {Object} user - Authenticated user
   * @returns {Boolean}
   */
  schema.methods.canView = function (user) {
    if (!user) return false;

    // Check organization membership
    if (this.organizationId && !this.organizationId.equals(user.organizationId)) {
      return false;
    }

    // All roles in the organization can view
    return true;
  };
}