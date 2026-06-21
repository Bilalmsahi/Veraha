import auditService from '../services/auditService.js';
import { sendPaginated, sendSuccess } from '../middleware/responseHandler.js';

export const listAudits = async (req, res, next) => {
  try {
    const { audits, pagination } = await auditService.listAudits(req.user.organizationId, req.query);
    return sendPaginated(res, audits, pagination);
  } catch (error) {
    next(error);
  }
};

export const createAudit = async (req, res, next) => {
  try {
    const audit = await auditService.createAudit(req.body, req.user);
    return sendSuccess(res, audit, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getAudit = async (req, res, next) => {
  try {
    const audit = await auditService.getAuditById(req.params.auditId, req.user.organizationId);
    return sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
};

export const getAuditReadiness = async (req, res, next) => {
  try {
    const readiness = await auditService.getAuditReadiness(req.params.auditId, req.user.organizationId);
    return sendSuccess(res, readiness);
  } catch (error) {
    next(error);
  }
};

export const getAuditActivity = async (req, res, next) => {
  try {
    const result = await auditService.getAuditActivity(req.params.auditId, req.user.organizationId, req.query);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getAuditStats = async (req, res, next) => {
  try {
    const stats = await auditService.getAuditStats(req.user.organizationId);
    return sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export const updateAudit = async (req, res, next) => {
  try {
    const audit = await auditService.updateAudit(req.params.auditId, req.body, req.user);
    return sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
};

export const transitionAudit = async (req, res, next) => {
  try {
    const audit = await auditService.transitionAudit(req.params.auditId, req.body.status, req.user);
    return sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
};

export const snapshotAudit = async (req, res, next) => {
  try {
    const result = await auditService.snapshotAudit(req.params.auditId, req.user);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Move an audit into the completion workflow after completion gates pass.
 */
export const completeAudit = async (req, res, next) => {
  try {
    const audit = await auditService.transitionAudit(req.params.auditId, 'COMPLETING', req.user);
    return sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
};

/**
 * List audit findings for an internal audit workspace.
 */
export const listAuditFindings = async (req, res, next) => {
  try {
    const findings = await auditService.listAuditFindings(req.params.auditId, req.user.organizationId, req.query);
    return sendSuccess(res, findings);
  } catch (error) {
    next(error);
  }
};

/**
 * Create an audit finding for an internal audit workspace.
 */
export const createAuditFinding = async (req, res, next) => {
  try {
    const finding = await auditService.createAuditFinding(req.params.auditId, req.body, req.user);
    return sendSuccess(res, finding, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an audit finding status or remediation note.
 */
export const updateAuditFinding = async (req, res, next) => {
  try {
    const finding = await auditService.updateAuditFinding(
      req.params.auditId,
      req.params.findingId,
      req.body,
      req.user
    );
    return sendSuccess(res, finding);
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete an open audit finding.
 */
export const deleteAuditFinding = async (req, res, next) => {
  try {
    const result = await auditService.deleteAuditFinding(req.params.auditId, req.params.findingId, req.user);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const lookupAuditor = async (req, res, next) => {
  try {
    const result = await auditService.lookupAuditorCandidate(req.params.auditId, req.body.email, req.user);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const inviteAuditor = async (req, res, next) => {
  try {
    const assignment = await auditService.inviteAuditor(req.params.auditId, req.body, req.user);
    return sendSuccess(res, assignment, null, 201);
  } catch (error) {
    next(error);
  }
};

export const listAuditEvidence = async (req, res, next) => {
  try {
    const evidence = await auditService.listAuditEvidence(req.params.auditId, req.user.organizationId, req.query);
    return sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

export const respondToEvidenceItem = async (req, res, next) => {
  try {
    const item = await auditService.respondToEvidenceItem(
      req.params.auditId,
      req.params.itemId,
      req.body,
      req.user
    );
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const listAuditRequests = async (req, res, next) => {
  try {
    const requests = await auditService.listAuditRequests(req.params.auditId, req.user.organizationId);
    return sendSuccess(res, requests);
  } catch (error) {
    next(error);
  }
};

export const getAuditRequest = async (req, res, next) => {
  try {
    const request = await auditService.getAuditRequestById(
      req.params.auditId,
      req.params.requestId,
      req.user.organizationId
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

/**
 * Append an internal-user-authored message to an audit evidence request thread.
 */
export const addAuditRequestMessage = async (req, res, next) => {
  try {
    const request = await auditService.addAuditRequestMessage(
      req.params.auditId,
      req.params.requestId,
      req.body,
      req.user,
      'INTERNAL'
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an audit evidence request's assignment, due date, or workflow status.
 */
export const updateAuditRequest = async (req, res, next) => {
  try {
    const request = await auditService.updateAuditRequest(req.params.auditId, req.params.requestId, req.body, req.user);
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

export const submitAuditRequest = async (req, res, next) => {
  try {
    const request = await auditService.submitAuditRequest(
      req.params.auditId,
      req.params.requestId,
      req.body.evidenceId,
      req.user
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

/**
 * Link an existing audit evidence item to a request as submitted evidence.
 */
export const submitEvidenceItemToRequest = async (req, res, next) => {
  try {
    const request = await auditService.submitAuditEvidenceItemToRequest(
      req.params.auditId,
      req.params.requestId,
      req.body.itemId,
      req.user
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

export const uploadAuditReport = async (req, res, next) => {
  try {
    const report = await auditService.uploadAuditReport(req.params.auditId, req.file, req.user);
    return sendSuccess(res, report, null, 201);
  } catch (error) {
    next(error);
  }
};

export default {
  listAudits,
  createAudit,
  getAudit,
  getAuditReadiness,
  getAuditActivity,
  getAuditStats,
  updateAudit,
  transitionAudit,
  snapshotAudit,
  completeAudit,
  listAuditFindings,
  createAuditFinding,
  updateAuditFinding,
  deleteAuditFinding,
  lookupAuditor,
  inviteAuditor,
  listAuditEvidence,
  respondToEvidenceItem,
  listAuditRequests,
  getAuditRequest,
  addAuditRequestMessage,
  updateAuditRequest,
  submitAuditRequest,
  submitEvidenceItemToRequest,
  uploadAuditReport,
};
