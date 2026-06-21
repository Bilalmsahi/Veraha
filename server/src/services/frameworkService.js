/**
 * Framework Service
 * Business logic for framework and requirement operations.
 * These are GLOBAL domain entities (no organizationId).
 */

import mongoose from 'mongoose';
import Framework from '../models/Framework.js';
import RequirementCategory from '../models/RequirementCategory.js';
import Requirement from '../models/Requirement.js';
import Organization from '../models/Organization.js';
import OrganizationFramework from '../models/OrganizationFramework.js';
import readinessService from './readinessService.js';
import { assertFrameworkGrantedForOrg } from './frameworkAccessService.js';

export const assertFrameworkAccessible = async (organizationId, codeOrId) => {
  return assertFrameworkGrantedForOrg(organizationId, codeOrId);
};

/**
 * Get all active frameworks
 * @returns {Promise<Array>} List of frameworks with requirement counts
 */
export const getAllFrameworks = async (organizationId = null) => {
  const frameworks = await Framework.find({ isActive: true })
    .select('code name version description')
    .sort({ code: 1 })
    .lean();

  const counts = await Requirement.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$frameworkId', requirementCount: { $sum: 1 } } },
  ]);
  const countByFramework = new Map(
    counts.map((c) => [String(c._id), c.requirementCount])
  );

  const withCounts = frameworks.map((f) => ({
    ...f,
    requirementCount: countByFramework.get(String(f._id)) ?? 0,
  }));

  if (!organizationId) return withCounts;

  const [organization, grants] = await Promise.all([
    Organization.findById(organizationId).select('settings.enabledFrameworks').lean(),
    OrganizationFramework.find({ organizationId, revokedAt: null }).select('frameworkId').lean(),
  ]);
  const purchasedFrameworkIds = new Set([
    ...((organization?.settings?.enabledFrameworks || []).map((id) => id.toString())),
    ...(grants.map((grant) => grant.frameworkId.toString())),
  ]);

  return Promise.all(
    withCounts.map(async (framework) => {
      try {
        const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
          organizationId,
          framework.code
        );
        return {
          ...framework,
          isPurchased: purchasedFrameworkIds.has(String(framework._id)),
          isAccessible: purchasedFrameworkIds.has(String(framework._id)),
          readinessScore: readiness.readinessScore,
          ready: readiness.rollup?.framework?.ready ?? false,
        };
      } catch {
        return {
          ...framework,
          isPurchased: purchasedFrameworkIds.has(String(framework._id)),
          isAccessible: purchasedFrameworkIds.has(String(framework._id)),
        };
      }
    })
  );
};

/**
 * Get single framework by code
 * @param {String} code - Framework code (SOC2, ISO27001, etc.)
 * @returns {Promise<Object>} Framework with requirement count
 */
export const getFrameworkByCode = async (code) => {
  const framework = await Framework.findOne({ 
    code: code.toUpperCase(), 
    isActive: true 
  }).lean();

  if (!framework) {
    const error = new Error(`Framework '${code}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Add requirement count
  const requirementCount = await Requirement.countDocuments({
    frameworkId: framework._id,
    isActive: true,
  });

  const categories = await RequirementCategory.find({
    frameworkId: framework._id,
    isActive: true,
  })
    .select('_id code title order')
    .sort({ order: 1, code: 1 })
    .lean();

  return { ...framework, requirementCount, categories };
};

/**
 * Requirement categories for a framework with requirement counts per category
 * @param {String} code - Framework code
 * @returns {Promise<Array<{ _id, frameworkId, code, title, order, requirementCount }>>}
 */
export const getCategoriesByFramework = async (code) => {
  const framework = await Framework.findOne({
    code: code.toUpperCase(),
    isActive: true,
  }).lean();

  if (!framework) {
    const error = new Error(`Framework '${code}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const categories = await RequirementCategory.find({
    frameworkId: framework._id,
    isActive: true,
  })
    .sort({ order: 1, code: 1 })
    .lean();

  const counts = await Requirement.aggregate([
    {
      $match: {
        frameworkId: framework._id,
        isActive: true,
        categoryId: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: '$categoryId', requirementCount: { $sum: 1 } } },
  ]);
  const countByCategory = new Map(
    counts.map((c) => [String(c._id), c.requirementCount])
  );

  return categories.map((cat) => ({
    ...cat,
    requirementCount: countByCategory.get(String(cat._id)) ?? 0,
  }));
};

/**
 * Get paginated requirements for a framework
 * @param {String} code - Framework code
 * @param {Object} options - Query options (page, limit, categoryId, search, sortBy, sortOrder)
 * @returns {Promise<Object>} { requirements, pagination }
 */
const ALLOWED_SORT_FIELDS = ['identifier', 'title'];

export const getRequirementsByFramework = async (code, options, organizationId = null) => {
  let {
    page = 1,
    limit = 20,
    categoryId,
    search,
    sortBy = 'identifier',
    sortOrder = 'asc',
  } = options;

  // Sanitize sortBy to prevent invalid MongoDB sort keys
  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    sortBy = 'identifier';
  }
  sortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

  // First, get the framework
  const framework = await Framework.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!framework) {
    const error = new Error(`Framework '${code}' not found`);
    error.statusCode = 404;
    throw error;
  }

  if (organizationId) {
    await assertFrameworkGrantedForOrg(organizationId, framework._id);
  }

  // Build query
  const query = {
    frameworkId: framework._id,
    isActive: true,
  };

  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) {
      const error = new Error('Invalid categoryId');
      error.statusCode = 400;
      throw error;
    }
    query.categoryId = new mongoose.Types.ObjectId(categoryId);
  }

  if (search) {
    query.$or = [
      { identifier: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Get total count
  const total = await Requirement.countDocuments(query);

  // Get paginated results
  const requirements = await Requirement.find(query)
    .select('identifier title description frameworkId categoryId')
    .populate({ path: 'categoryId', select: 'code title order' })
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  return {
    requirements,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get single requirement by ID
 * @param {String} id - Requirement ObjectId
 * @returns {Promise<Object>} Requirement with framework info
 */
export const getRequirementById = async (id) => {
  const requirement = await Requirement.findOne({
    _id: id,
    isActive: true,
  })
    .populate('frameworkId', 'code name version')
    .populate('categoryId', 'code title order')
    .lean();

  if (!requirement) {
    const error = new Error('Requirement not found');
    error.statusCode = 404;
    throw error;
  }

  // Rename frameworkId to framework for cleaner response
  const { frameworkId, ...rest } = requirement;
  return { ...rest, framework: frameworkId };
};

export default {
  assertFrameworkAccessible,
  getAllFrameworks,
  getFrameworkByCode,
  getCategoriesByFramework,
  getRequirementsByFramework,
  getRequirementById,
};
