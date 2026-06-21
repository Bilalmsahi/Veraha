/**
 * AWS Integration Controller
 * HTTP handlers for AWS account and finding endpoints
 */
import * as awsService from '../services/awsIntegration.service.js';
import { sendSuccess, sendPaginated } from '../middleware/responseHandler.js';
import AwsAccount from '../models/AwsAccount.js';
import AwsFinding from '../models/AwsFinding.js';

// =============================================================================
// AWS ACCOUNTS
// =============================================================================

/**
 * GET /api/v1/integrations/aws/accounts
 * List AWS accounts for the organization
 */
export const listAccounts = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const { search, page = 1, limit = 20 } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (search) {
      filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [accounts, total] = await Promise.all([
      AwsAccount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      AwsAccount.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    sendPaginated(res, accounts, {
      page: pageNum,
      limit: limitNum,
      total,
      pages,
      hasNextPage: pageNum < pages,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/aws/accounts
 * Create a new AWS account
 */
export const createAccount = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const account = await awsService.createAccount(organizationId, userId, req.body);
    sendSuccess(res, account, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/integrations/aws/accounts/:id
 * Update an AWS account
 */
export const updateAccount = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const account = await awsService.updateAccount(organizationId, req.params.id, req.body);
    sendSuccess(res, account);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/integrations/aws/accounts/:id
 * Soft-delete an AWS account
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const result = await awsService.deleteAccount(organizationId, req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/aws/accounts/:id/controls
 * Link controls to an AWS account
 */
export const linkAccountControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const account = await awsService.linkToControl(
      AwsAccount,
      organizationId,
      req.params.id,
      req.body.controlIds
    );
    sendSuccess(res, account);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/integrations/aws/accounts/:id/controls/:controlId
 * Unlink a control from an AWS account
 */
export const unlinkAccountControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const account = await awsService.unlinkFromControl(
      AwsAccount,
      organizationId,
      req.params.id,
      req.params.controlId
    );
    sendSuccess(res, account);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// AWS FINDINGS
// =============================================================================

/**
 * GET /api/v1/integrations/aws/accounts/:accountId/findings
 * List findings for an AWS account
 */
export const listFindings = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const { status, severity, service, page = 1, limit = 20 } = req.query;

    const filter = {
      organizationId,
      awsAccountId: req.params.accountId,
      isDeleted: false,
    };

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (service) filter.affectedService = service;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [findings, total] = await Promise.all([
      AwsFinding.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      AwsFinding.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limitNum);

    sendPaginated(res, findings, {
      page: pageNum,
      limit: limitNum,
      total,
      pages,
      hasNextPage: pageNum < pages,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/aws/accounts/:accountId/findings
 * Create a finding for an AWS account
 */
export const createFinding = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const finding = await awsService.createFinding(
      organizationId,
      req.params.accountId,
      userId,
      req.body
    );
    sendSuccess(res, finding, null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/integrations/aws/findings/:id
 * Update an AWS finding
 */
export const updateFinding = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const finding = await awsService.updateFinding(organizationId, req.params.id, req.body);
    sendSuccess(res, finding);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/aws/findings/:id/controls
 * Link controls to an AWS finding
 */
export const linkFindingControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const finding = await awsService.linkToControl(
      AwsFinding,
      organizationId,
      req.params.id,
      req.body.controlIds
    );
    sendSuccess(res, finding);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/integrations/aws/findings/:id/controls/:controlId
 * Unlink a control from an AWS finding
 */
export const unlinkFindingControl = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const finding = await awsService.unlinkFromControl(
      AwsFinding,
      organizationId,
      req.params.id,
      req.params.controlId
    );
    sendSuccess(res, finding);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * GET /api/v1/integrations/aws/stats
 * Get AWS integration statistics
 */
export const getAwsStats = async (req, res, next) => {
  try {
    const { organizationId } = req.user;
    const stats = await awsService.getStats(organizationId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export default {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  linkAccountControl,
  unlinkAccountControl,
  listFindings,
  createFinding,
  updateFinding,
  linkFindingControl,
  unlinkFindingControl,
  getAwsStats,
};
