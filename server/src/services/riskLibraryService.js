import RiskTemplate from '../models/RiskTemplate.js';
import Risk from '../models/Risk.js';
import { logCrudOperation } from './activityLogger.js';

/**
 * List risk library entries visible to the user's org (global + org-specific)
 */
export const listRiskTemplates = async (organizationId, options) => {
  const { page = 1, limit = 20, category, search, sortBy = 'title', sortOrder = 'asc' } = options;

  const query = {
    isActive: true,
    $or: [{ isGlobal: true }, { organizationId }],
  };

  if (category) query.categoryNames = category;

  if (search) {
    query.$and = [
      query.$or ? { $or: query.$or } : {},
      {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      },
    ];
    delete query.$or;
  }

  const total = await RiskTemplate.countDocuments(query);
  const templates = await RiskTemplate.find(query)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  return {
    templates,
    pagination: { page, limit, total, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
};

/**
 * Get a single risk template by ID
 */
export const getRiskTemplateById = async (id, organizationId) => {
  const template = await RiskTemplate.findOne({
    _id: id,
    isActive: true,
    $or: [{ isGlobal: true }, { organizationId }],
  }).lean();

  if (!template) {
    const error = new Error('Risk template not found');
    error.statusCode = 404;
    throw error;
  }

  return template;
};

/**
 * Create a new org-specific risk template
 */
export const createRiskTemplate = async (data, user) => {
  const template = await RiskTemplate.create({
    ...data,
    organizationId: user.organizationId,
    isGlobal: false,
  });

  await logCrudOperation({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'CREATE',
    entityType: 'RiskTemplate',
    entityId: template._id,
    entitySnapshot: { title: template.title },
  });

  return template;
};

/**
 * Update an org-specific risk template (cannot edit global)
 */
export const updateRiskTemplate = async (id, data, user) => {
  const template = await RiskTemplate.findOne({
    _id: id,
    organizationId: user.organizationId,
    isGlobal: false,
    isActive: true,
  });

  if (!template) {
    const error = new Error('Risk template not found or cannot be edited');
    error.statusCode = 404;
    throw error;
  }

  Object.assign(template, data);
  await template.save();

  await logCrudOperation({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'UPDATE',
    entityType: 'RiskTemplate',
    entityId: template._id,
    entitySnapshot: { title: template.title },
  });

  return template;
};

/**
 * Soft-delete an org-specific risk template
 */
export const deleteRiskTemplate = async (id, user) => {
  const template = await RiskTemplate.findOne({
    _id: id,
    organizationId: user.organizationId,
    isGlobal: false,
    isActive: true,
  });

  if (!template) {
    const error = new Error('Risk template not found or cannot be deleted');
    error.statusCode = 404;
    throw error;
  }

  template.isActive = false;
  await template.save();

  await logCrudOperation({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'DELETE',
    entityType: 'RiskTemplate',
    entityId: template._id,
    entitySnapshot: { title: template.title },
  });

  return { deleted: true };
};

/**
 * Import a risk template into the org's active risk register
 */
export const importToRegister = async (id, user) => {
  const template = await RiskTemplate.findOne({
    _id: id,
    isActive: true,
    $or: [{ isGlobal: true }, { organizationId: user.organizationId }],
  });

  if (!template) {
    const error = new Error('Risk template not found');
    error.statusCode = 404;
    throw error;
  }

  const count = await Risk.countDocuments({ organizationId: user.organizationId, isDeleted: false });
  const identifier = `RISK-${String(count + 1).padStart(3, '0')}`;

  const risk = await Risk.create({
    organizationId: user.organizationId,
    identifier,
    title: template.title,
    description: template.description,
    categories: template.categoryNames || [],
    likelihood: null,
    impact: null,
    treatment: null,
    reviewStatus: 'NOT_REVIEWED',
    templateId: template._id,
    status: 'OPEN',
    identifiedBy: user._id,
    identifiedAt: new Date(),
    ownerId: user._id,
  });

  await logCrudOperation({
    organizationId: user.organizationId,
    actorId: user._id,
    action: 'CREATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title, source: 'risk-library', templateId: template._id },
  });

  return risk;
};

/**
 * Get unique category names from risk library (from categoryNames arrays)
 */
export const getCategories = async (organizationId) => {
  const templates = await RiskTemplate.find(
    { isActive: true, $or: [{ isGlobal: true }, { organizationId }] },
    { categoryNames: 1 }
  )
    .lean();
  const set = new Set();
  for (const t of templates) {
    if (Array.isArray(t.categoryNames)) t.categoryNames.forEach((c) => set.add(c));
  }
  return [...set].filter(Boolean).sort();
};

export default {
  listRiskTemplates,
  getRiskTemplateById,
  createRiskTemplate,
  updateRiskTemplate,
  deleteRiskTemplate,
  importToRegister,
  getCategories,
};
