/**
 * Policy Controller
 * HTTP handlers for Policy API endpoints
 */
import policyService from '../services/policyService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

// =============================================================================
// POLICY CRUD
// =============================================================================

/**
 * POST /api/v1/policies
 * Create new policy
 */
export const createPolicy = async (req, res, next) => {
  try {
    const policy = await policyService.createPolicy(req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, policy, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/policies
 * List policies with filters
 */
export const getPolicies = async (req, res, next) => {
  try {
    const result = await policyService.getPolicies(
      req.user.organizationId,
      req.query,
      req.user._id
    );
    sendSuccess(res, result.policies, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/policies/stats
 * Get policy statistics
 */
export const getPolicyStats = async (req, res, next) => {
  try {
    const stats = await policyService.getPolicyStats(
      req.user.organizationId,
      req.user._id
    );
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/policies/pending-attestations
 * Get policies pending attestation for current user
 */
export const getPendingAttestations = async (req, res, next) => {
  try {
    const pending = await policyService.getPendingAttestations(
      req.user.organizationId,
      req.user._id
    );
    sendSuccess(res, pending);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/policies/:id
 * Get policy with versions
 */
export const getPolicyById = async (req, res, next) => {
  try {
    const policy = await policyService.getPolicyById(
      req.params.id,
      req.user.organizationId
    );
    sendSuccess(res, policy);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/policies/:id
 * Update policy metadata
 */
export const updatePolicy = async (req, res, next) => {
  try {
    const policy = await policyService.updatePolicy(req.params.id, req.body, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, policy);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/policies/:id/archive
 * Archive policy
 * @deprecated Use policyWorkflowController.archive via POST /api/v1/policies/:id/archive-workflow.
 */
export const archivePolicy = async (req, res, next) => {
  try {
    const policy = await policyService.archivePolicy(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, policy);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/policies/:id
 * Soft delete policy
 */
export const deletePolicy = async (req, res, next) => {
  try {
    const result = await policyService.deletePolicy(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

/**
 * POST /api/v1/policies/:id/versions
 * Create new version (with optional file upload)
 */
export const createVersion = async (req, res, next) => {
  try {
    const version = await policyService.createVersion(
      req.params.id,
      req.body,
      req.file || null,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, version, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/policies/:id/editor-draft
 * Create or reuse a single editable DRAFT version for the rich-text editor.
 */
export const getOrCreateEditorDraft = async (req, res, next) => {
  try {
    const version = await policyService.getOrCreateEditorDraft(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, version, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/policies/:id/editor-draft/reset
 * Reset the editable rich-text draft from the latest approved/editor source.
 */
export const resetEditorDraft = async (req, res, next) => {
  try {
    const version = await policyService.resetEditorDraft(req.params.id, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    sendSuccess(res, version);
  } catch (error) {
    next(error);
  }
};

export const getContentDocumentUrl = async (req, res, next) => {
  try {
    const result = await policyService.getPolicyContentDocumentUrl(
      req.params.id,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      },
      { versionId: req.query.versionId }
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const importContentDocument = async (req, res, next) => {
  try {
    const version = await policyService.importPolicyContentDocument(
      req.params.id,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      },
      {
        versionId: req.body?.versionId,
        force: req.body?.force === true,
      }
    );
    sendSuccess(res, version);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/policies/:id/images
 * TinyMCE image upload endpoint. TinyMCE expects an unwrapped { location } response.
 */
export const uploadPolicyImage = async (req, res, next) => {
  try {
    const result = await policyService.uploadPolicyImage(req.params.id, req.file || null, {
      organizationId: req.user.organizationId,
      userId: req.user._id,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/policies/:id/versions/:versionId
 * Update draft version
 */
export const updateVersion = async (req, res, next) => {
  try {
    const version = await policyService.updateVersion(
      req.params.id,
      req.params.versionId,
      req.body,
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, version);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/policies/:id/versions/:versionId/publish
 * Publish version (DRAFT → ACTIVE)
 * @deprecated Use policyWorkflowController.publish via POST /api/v1/policies/:id/publish.
 */
export const publishVersion = async (req, res, next) => {
  try {
    const result = await policyService.publishVersion(
      req.params.id,
      req.params.versionId,
      req.body || {},
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      }
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// ATTESTATION
// =============================================================================

/**
 * POST /api/v1/policies/:id/attest
 * Sign/attest to policy
 */
export const createAttestation = async (req, res, next) => {
  try {
    const attestation = await policyService.createAttestation(
      req.params.id,
      req.body || {},
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
      },
      req
    );
    sendSuccess(res, attestation, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/policies/:id/attestations
 * Get attestations for policy's current version
 */
export const getAttestations = async (req, res, next) => {
  try {
    const result = await policyService.getAttestations(
      req.params.id,
      req.user.organizationId,
      req.query
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export default {
  createPolicy,
  getPolicies,
  getPolicyStats,
  getPendingAttestations,
  getPolicyById,
  updatePolicy,
  archivePolicy,
  deletePolicy,
  createVersion,
  getOrCreateEditorDraft,
  resetEditorDraft,
  getContentDocumentUrl,
  importContentDocument,
  uploadPolicyImage,
  updateVersion,
  publishVersion,
  createAttestation,
  getAttestations,
};
