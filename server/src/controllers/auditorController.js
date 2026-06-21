import auditService from '../services/auditService.js';
import { sendSuccess } from '../middleware/responseHandler.js';

export const listEngagements = async (req, res, next) => {
  try {
    const engagements = await auditService.listAuditorEngagements(req.user);
    return sendSuccess(res, engagements);
  } catch (error) {
    next(error);
  }
};

export const getEngagement = async (req, res, next) => {
  try {
    const engagement = await auditService.getAuditorEngagement(req.params.auditId, req.auditAssignment);
    return sendSuccess(res, engagement);
  } catch (error) {
    next(error);
  }
};

export const listEvidence = async (req, res, next) => {
  try {
    const evidence = await auditService.listAuditEvidence(req.params.auditId, req.auditOrgId, req.query);
    return sendSuccess(res, evidence);
  } catch (error) {
    next(error);
  }
};

export const approveEvidence = async (req, res, next) => {
  try {
    const item = await auditService.reviewAuditEvidenceItem(
      req.params.auditId,
      req.params.itemId,
      'approve',
      req.body,
      req.user,
      req.auditOrgId
    );
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const flagEvidence = async (req, res, next) => {
  try {
    const item = await auditService.reviewAuditEvidenceItem(
      req.params.auditId,
      req.params.itemId,
      'flag',
      req.body,
      req.user,
      req.auditOrgId
    );
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const markNotApplicable = async (req, res, next) => {
  try {
    const item = await auditService.reviewAuditEvidenceItem(
      req.params.auditId,
      req.params.itemId,
      'notApplicable',
      req.body,
      req.user,
      req.auditOrgId
    );
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const listRequests = async (req, res, next) => {
  try {
    const requests = await auditService.listAuditRequests(req.params.auditId, req.auditOrgId);
    return sendSuccess(res, requests);
  } catch (error) {
    next(error);
  }
};

/**
 * Return one audit evidence request with its full collaboration thread.
 */
export const getRequest = async (req, res, next) => {
  try {
    const request = await auditService.getAuditRequestById(
      req.params.auditId,
      req.params.requestId,
      req.auditOrgId
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

export const createRequest = async (req, res, next) => {
  try {
    const request = await auditService.createAuditRequest(req.params.auditId, req.body, req.user, req.auditOrgId);
    return sendSuccess(res, request, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * List audit findings visible to the assigned auditor.
 */
export const listFindings = async (req, res, next) => {
  try {
    const findings = await auditService.listAuditFindings(req.params.auditId, req.auditOrgId, req.query);
    return sendSuccess(res, findings);
  } catch (error) {
    next(error);
  }
};

/**
 * Create an audit finding from the auditor portal.
 */
export const createFinding = async (req, res, next) => {
  try {
    const finding = await auditService.createAuditFinding(req.params.auditId, req.body, req.user, req.auditOrgId);
    return sendSuccess(res, finding, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Append an auditor-authored message to an audit evidence request thread.
 */
export const addRequestMessage = async (req, res, next) => {
  try {
    const request = await auditService.addAuditRequestMessage(
      req.params.auditId,
      req.params.requestId,
      req.body,
      req.user,
      'AUDITOR',
      req.auditOrgId
    );
    return sendSuccess(res, request);
  } catch (error) {
    next(error);
  }
};

export const completeAudit = async (req, res, next) => {
  try {
    const audit = await auditService.transitionAudit(req.params.auditId, 'COMPLETING', {
      _id: req.user._id,
      organizationId: req.auditOrgId,
    });
    return sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
};

export const uploadReport = async (req, res, next) => {
  try {
    const report = await auditService.uploadAuditReport(req.params.auditId, req.file, req.user, req.auditOrgId);
    return sendSuccess(res, report, null, 201);
  } catch (error) {
    next(error);
  }
};

export default {
  listEngagements,
  getEngagement,
  listEvidence,
  approveEvidence,
  flagEvidence,
  markNotApplicable,
  listRequests,
  getRequest,
  createRequest,
  listFindings,
  createFinding,
  addRequestMessage,
  completeAudit,
  uploadReport,
};
