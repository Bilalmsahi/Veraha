/**
 * Comment Controller
 */
import commentService from '../services/commentService.js';
import Policy from '../models/Policy.js';
import Risk from '../models/Risk.js';
import Evidence from '../models/Evidence.js';
import Test from '../models/Test.js';
import { sendSuccess } from '../middleware/responseHandler.js';

const ENTITY_VERIFY = {
  Policy: async (entityId, orgId) => {
    const policy = await Policy.findOne({ _id: entityId, organizationId: orgId, isDeleted: false });
    return !!policy;
  },
  Risk: async (entityId, orgId) => {
    const risk = await Risk.findOne({ _id: entityId, organizationId: orgId, isDeleted: false });
    return !!risk;
  },
  Evidence: async (entityId, orgId) => {
    const evidence = await Evidence.findOne({ _id: entityId, organizationId: orgId, isDeleted: false });
    return !!evidence;
  },
  Test: async (entityId, orgId) => {
    const test = await Test.findOne({ _id: entityId, organizationId: orgId, isDeleted: false });
    return !!test;
  },
};

export const getPolicyComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified = await ENTITY_VERIFY.Policy(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }
    const result = await commentService.getComments(
      req.user.organizationId,
      'Policy',
      id,
      { page: req.query.page || 1, limit: req.query.limit || 50 }
    );
    sendSuccess(res, result.comments, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createPolicyComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const verified = await ENTITY_VERIFY.Policy(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    const comment = await commentService.createComment(
      req.user.organizationId,
      'Policy',
      id,
      req.user._id,
      content
    );
    sendSuccess(res, comment, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getRiskComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified = await ENTITY_VERIFY.Risk(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Risk not found' });
    }
    const result = await commentService.getComments(
      req.user.organizationId,
      'Risk',
      id,
      { page: req.query.page || 1, limit: req.query.limit || 50 }
    );
    sendSuccess(res, result.comments, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createRiskComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const verified = await ENTITY_VERIFY.Risk(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Risk not found' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    const comment = await commentService.createComment(
      req.user.organizationId,
      'Risk',
      id,
      req.user._id,
      content
    );
    sendSuccess(res, comment, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getEvidenceComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified = await ENTITY_VERIFY.Evidence(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }
    const result = await commentService.getComments(
      req.user.organizationId,
      'Evidence',
      id,
      { page: req.query.page || 1, limit: req.query.limit || 50 }
    );
    sendSuccess(res, result.comments, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createEvidenceComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const verified = await ENTITY_VERIFY.Evidence(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    const comment = await commentService.createComment(
      req.user.organizationId,
      'Evidence',
      id,
      req.user._id,
      content
    );
    sendSuccess(res, comment, null, 201);
  } catch (error) {
    next(error);
  }
};

export const getTestComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verified = await ENTITY_VERIFY.Test(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    const result = await commentService.getComments(
      req.user.organizationId,
      'Test',
      id,
      { page: req.query.page || 1, limit: req.query.limit || 50 }
    );
    sendSuccess(res, result.comments, result.pagination);
  } catch (error) {
    next(error);
  }
};

export const createTestComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const verified = await ENTITY_VERIFY.Test(id, req.user.organizationId);
    if (!verified) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    const comment = await commentService.createComment(
      req.user.organizationId,
      'Test',
      id,
      req.user._id,
      content
    );
    sendSuccess(res, comment, null, 201);
  } catch (error) {
    next(error);
  }
};

export default {
  getPolicyComments,
  createPolicyComment,
  getRiskComments,
  createRiskComment,
  getEvidenceComments,
  createEvidenceComment,
  getTestComments,
  createTestComment,
};
