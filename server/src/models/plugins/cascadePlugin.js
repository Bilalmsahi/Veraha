import mongoose from 'mongoose';

/**
 * Cascade Plugin for Soft Delete Operations
 * 
 * Automatically handles cleanup of references when entities are soft-deleted.
 * Can be used independently or alongside tenantPlugin's enhancedSoftDelete.
 * 
 * Usage:
 *   import cascadePlugin from './plugins/cascadePlugin.js';
 *   
 *   mySchema.plugin(cascadePlugin, {
 *     removeReferences: [
 *       { model: 'Evidence', field: 'linkedControlIds' },
 *       { model: 'Risk', field: 'mitigatingControlIds' }
 *     ],
 *     onCascadeError: 'log' // or 'throw'
 *   });
 */
export default function cascadePlugin(schema, options = {}) {
  const { 
    removeReferences = [],
    onCascadeError = 'log', // 'log' or 'throw'
    logCascades = true,
  } = options;
  
  // ==========================================================================
  // MIDDLEWARE: Auto-cascade on soft delete
  // ==========================================================================
  
  /**
   * Post-save hook for soft delete cascade
   * Triggers when document.save() is called after setting isDeleted = true
   */
  schema.post('save', async function (doc, next) {
    // Only run cascade if document was soft-deleted
    if (!doc.isDeleted || !doc.deletedAt) {
      return next();
    }
    
    // Check if this is a new soft delete (not an update to already deleted doc)
    const original = this._original;
    if (original && original.isDeleted) {
      return next(); // Already deleted before
    }
    
    try {
      await cascadeReferences(doc, removeReferences, { logCascades, onCascadeError });
      next();
    } catch (error) {
      if (onCascadeError === 'throw') {
        return next(error);
      }
      // Log but don't fail
      console.error('[Cascade Plugin] Error during cascade:', error);
      next();
    }
  });
  
  /**
   * Post-hook for findOneAndUpdate (for static softDelete methods)
   * Triggers when Model.softDelete(id, userId) is called
   */
  schema.post('findOneAndUpdate', async function (doc) {
    if (!doc || !doc.isDeleted) return;
    
    // Check if this was a soft delete operation
    const update = this.getUpdate();
    const wasDeleted = update.isDeleted || update.$set?.isDeleted;
    
    if (!wasDeleted) return;
    
    try {
      await cascadeReferences(doc, removeReferences, { logCascades, onCascadeError });
    } catch (error) {
      if (onCascadeError === 'throw') {
        throw error;
      }
      console.error('[Cascade Plugin] Error during cascade:', error);
    }
  });
  
  // Store original document for comparison
  // Mongoose 9.x: No next callback needed
  schema.pre('save', function () {
    if (!this.isNew) {
      this._original = this.toObject();
    }
  });
  
  // ==========================================================================
  // STATIC METHODS: Manual cascade control
  // ==========================================================================
  
  /**
   * Manually trigger cascade cleanup for a document
   * Useful for fixing orphaned references
   * 
   * @param {ObjectId} documentId - Document ID to cascade from
   * @returns {Promise<Object>} Cascade results
   */
  schema.statics.cascadeCleanup = async function (documentId) {
    const doc = await this.findById(documentId).setOptions({ includeDeleted: true });
    
    if (!doc) {
      throw new Error('Document not found');
    }
    
    return cascadeReferences(doc, removeReferences, { logCascades, onCascadeError });
  };
  
  /**
   * Preview what would be cascaded (dry run)
   * 
   * @param {ObjectId} documentId - Document ID to check
   * @returns {Promise<Array>} List of affected references
   */
  schema.statics.previewCascade = async function (documentId) {
    const preview = [];
    
    for (const { model: modelName, field } of removeReferences) {
      try {
        const Model = mongoose.model(modelName);
        const count = await Model.countDocuments({ [field]: documentId });
        
        if (count > 0) {
          preview.push({
            model: modelName,
            field,
            affectedDocuments: count,
          });
        }
      } catch (error) {
        preview.push({
          model: modelName,
          field,
          error: error.message,
        });
      }
    }
    
    return preview;
  };
}

// =============================================================================
// CORE CASCADE LOGIC
// =============================================================================

/**
 * Remove references to soft-deleted entity from other collections
 * 
 * @param {Document} deletedDoc - The soft-deleted document
 * @param {Array} removeReferences - Array of { model, field } to cascade
 * @param {Object} options - { logCascades, onCascadeError }
 * @returns {Promise<Object>} Cascade results
 */
async function cascadeReferences(deletedDoc, removeReferences, options = {}) {
  const { logCascades = true, onCascadeError = 'log' } = options;
  
  const results = {
    success: [],
    errors: [],
    totalModified: 0,
  };
  
  for (const { model: modelName, field } of removeReferences) {
    try {
      const Model = mongoose.model(modelName);
      
      // Remove the deleted doc's ID from array fields
      const updateResult = await Model.updateMany(
        { [field]: deletedDoc._id },
        { $pull: { [field]: deletedDoc._id } }
      );
      
      results.success.push({
        model: modelName,
        field,
        modified: updateResult.modifiedCount,
      });
      
      results.totalModified += updateResult.modifiedCount;
      
      if (logCascades && updateResult.modifiedCount > 0) {
        console.log(
          `[Cascade] Removed ${deletedDoc._id} from ${updateResult.modifiedCount} ${modelName}.${field} reference(s)`
        );
      }
    } catch (error) {
      const errorInfo = {
        model: modelName,
        field,
        error: error.message,
      };
      
      results.errors.push(errorInfo);
      
      console.error(
        `[Cascade Error] Failed to remove ${deletedDoc._id} from ${modelName}.${field}:`,
        error.message
      );
      
      // Throw error if configured to do so
      if (onCascadeError === 'throw') {
        throw new Error(`Cascade failed for ${modelName}.${field}: ${error.message}`);
      }
    }
  }
  
  return results;
}

// =============================================================================
// ADVANCED CASCADE STRATEGIES
// =============================================================================

/**
 * Bidirectional Cascade Plugin
 * 
 * Handles both forward and reverse cascades
 * Example: When deleting a Control, also soft-delete orphaned Evidence
 * 
 * Usage:
 *   mySchema.plugin(bidirectionalCascade, {
 *     removeReferences: [
 *       { model: 'Evidence', field: 'linkedControlIds' }
 *     ],
 *     cascadeDelete: [
 *       { 
 *         model: 'Evidence', 
 *         condition: (doc) => ({ linkedControlIds: doc._id }),
 *         ifOrphaned: true // only cascade if no other references remain
 *       }
 *     ]
 *   });
 */
export function bidirectionalCascade(schema, options = {}) {
  const {
    removeReferences = [],
    cascadeDelete = [],
    onCascadeError = 'log',
  } = options;
  
  schema.post('save', async function (doc, next) {
    if (!doc.isDeleted || !doc.deletedAt) {
      return next();
    }
    
    const original = this._original;
    if (original && original.isDeleted) {
      return next();
    }
    
    try {
      // 1. Remove references
      await cascadeReferences(doc, removeReferences, { onCascadeError });
      
      // 2. Cascade deletes for dependent entities
      for (const cascade of cascadeDelete) {
        const { model: modelName, condition, ifOrphaned = false } = cascade;
        const Model = mongoose.model(modelName);
        
        const query = typeof condition === 'function' ? condition(doc) : condition;
        
        if (ifOrphaned) {
          // Only delete if this was the last reference
          const candidates = await Model.find(query);
          
          for (const candidate of candidates) {
            // Check if any reference fields are now empty
            const isEmpty = removeReferences.every(ref => {
              if (ref.model === modelName) {
                const fieldValue = candidate[ref.field];
                return !fieldValue || fieldValue.length === 0;
              }
              return true;
            });
            
            if (isEmpty && !candidate.isDeleted) {
              candidate.isDeleted = true;
              candidate.deletedAt = new Date();
              candidate.deletedBy = doc.deletedBy;
              await candidate.save();
              
              console.log(`[Cascade Delete] Orphaned ${modelName} ${candidate._id} deleted`);
            }
          }
        } else {
          // Delete all matching documents
          await Model.updateMany(query, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: doc.deletedBy,
          });
        }
      }
      
      next();
    } catch (error) {
      if (onCascadeError === 'throw') {
        return next(error);
      }
      console.error('[Bidirectional Cascade Error]:', error);
      next();
    }
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find all orphaned references in a collection
 * Useful for cleanup/maintenance
 * 
 * @param {Model} Model - Mongoose model to check
 * @param {String} field - Array field containing references
 * @param {Model} ReferencedModel - Model being referenced
 * @returns {Promise<Array>} Documents with orphaned references
 */
export async function findOrphanedReferences(Model, field, ReferencedModel) {
  const docs = await Model.find({ [field]: { $exists: true, $ne: [] } });
  const orphaned = [];
  
  for (const doc of docs) {
    const references = doc[field] || [];
    
    if (references.length === 0) continue;
    
    // Check which references don't exist
    const existingIds = await ReferencedModel.find({
      _id: { $in: references },
      isDeleted: { $ne: true },
    }).distinct('_id');
    
    const existingIdStrings = existingIds.map(id => id.toString());
    const orphanedIds = references.filter(
      id => !existingIdStrings.includes(id.toString())
    );
    
    if (orphanedIds.length > 0) {
      orphaned.push({
        documentId: doc._id,
        field,
        orphanedReferences: orphanedIds,
        totalReferences: references.length,
      });
    }
  }
  
  return orphaned;
}

/**
 * Clean up all orphaned references for a model
 * 
 * @param {Model} Model - Model to clean
 * @param {String} field - Field to clean
 * @param {Array} orphanedIds - IDs to remove
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanupOrphanedReferences(Model, field, orphanedIds) {
  const result = await Model.updateMany(
    { [field]: { $in: orphanedIds } },
    { $pull: { [field]: { $in: orphanedIds } } }
  );
  
  return {
    modified: result.modifiedCount,
    orphanedIds: orphanedIds.length,
  };
}

/**
 * Example usage in maintenance script:
 * 
 * import { findOrphanedReferences, cleanupOrphanedReferences } from './plugins/cascadePlugin.js';
 * import { Evidence, InternalControl } from './models/index.js';
 * 
 * // Find orphaned control references in evidence
 * const orphaned = await findOrphanedReferences(
 *   Evidence,
 *   'linkedControlIds',
 *   InternalControl
 * );
 * 
 * // Clean them up
 * if (orphaned.length > 0) {
 *   const allOrphanedIds = orphaned.flatMap(o => o.orphanedReferences);
 *   await cleanupOrphanedReferences(Evidence, 'linkedControlIds', allOrphanedIds);
 * }
 */