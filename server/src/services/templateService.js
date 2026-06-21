/**
 * Template Service
 * Business logic for global control template operations.
 * These are GLOBAL domain entities (no organizationId).
 */

import GlobalControlTemplate from '../models/GlobalControlTemplate.js';
import Framework from '../models/Framework.js';

/**
 * Get paginated templates with filters
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { templates, pagination }
 */
export const getTemplates = async (options) => {
  const { 
    page = 1, 
    limit = 20, 
    controlGroup, 
    frameworkCode, 
    search, 
    sortBy = 'identifier', 
    sortOrder = 'asc' 
  } = options;

  // Build query
  const query = { isActive: true };

  if (controlGroup) {
    query.controlGroup = controlGroup;
  }

  // Filter by framework - templates that have requirements for this framework
  if (frameworkCode) {
    const framework = await Framework.findOne({ 
      code: frameworkCode.toUpperCase(), 
      isActive: true 
    });
    if (framework) {
      query['suggestedRequirements.frameworkId'] = framework._id;
    }
  }

  if (search) {
    query.$or = [
      { identifier: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Get total count
  const total = await GlobalControlTemplate.countDocuments(query);

  // Get paginated results
  const templates = await GlobalControlTemplate.find(query)
    .select('identifier title description controlGroup frequency suggestedRequirements')
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Add requirement count to each template
  const templatesWithCounts = templates.map(t => ({
    _id: t._id,
    identifier: t.identifier,
    title: t.title,
    description: t.description,
    controlGroup: t.controlGroup,
    frequency: t.frequency,
    requirementCount: t.suggestedRequirements?.length || 0,
  }));

  const pages = Math.ceil(total / limit);

  return {
    templates: templatesWithCounts,
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
 * Get single template by ID with full details
 * @param {String} id - Template ObjectId
 * @returns {Promise<Object>} Template with populated requirements
 */
export const getTemplateById = async (id) => {
  const template = await GlobalControlTemplate.findOne({
    _id: id,
    isActive: true,
  })
    .populate({
      path: 'suggestedRequirements.requirementId',
      select: 'identifier title',
    })
    .populate({
      path: 'suggestedRequirements.frameworkId',
      select: 'code name',
    })
    .lean();

  if (!template) {
    const error = new Error('Template not found');
    error.statusCode = 404;
    throw error;
  }

  // Transform suggestedRequirements for cleaner response
  const transformedRequirements = template.suggestedRequirements.map(sr => ({
    requirement: sr.requirementId,
    framework: sr.frameworkId,
    coverage: sr.coverage,
    justification: sr.justification,
  }));

  return {
    ...template,
    suggestedRequirements: transformedRequirements,
  };
};

/**
 * Get templates filtered by framework code
 * @param {String} code - Framework code
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} { templates, pagination, framework }
 */
export const getTemplatesByFramework = async (code, options) => {
  const { page = 1, limit = 20, sortBy = 'identifier', sortOrder = 'asc' } = options;

  // Get framework
  const framework = await Framework.findOne({ 
    code: code.toUpperCase(), 
    isActive: true 
  });

  if (!framework) {
    const error = new Error(`Framework '${code}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Build query
  const query = {
    isActive: true,
    'suggestedRequirements.frameworkId': framework._id,
  };

  // Get total count
  const total = await GlobalControlTemplate.countDocuments(query);

  // Get paginated results
  const templates = await GlobalControlTemplate.find(query)
    .select('identifier title description controlGroup frequency suggestedRequirements')
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Filter suggestedRequirements to only include the requested framework
  // and count how many requirements from this framework
  const templatesWithFrameworkRequirements = templates.map(t => {
    const frameworkRequirements = t.suggestedRequirements.filter(
      sr => sr.frameworkId.equals(framework._id)
    );
    return {
      _id: t._id,
      identifier: t.identifier,
      title: t.title,
      description: t.description,
      controlGroup: t.controlGroup,
      frequency: t.frequency,
      requirementCount: frameworkRequirements.length,
    };
  });

  const pages = Math.ceil(total / limit);

  return {
    templates: templatesWithFrameworkRequirements,
    framework: {
      _id: framework._id,
      code: framework.code,
      name: framework.name,
    },
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
 * Get unique categories from all active templates
 * @returns {Promise<Array>} List of unique categories with counts
 */
export const getCategories = async () => {
  const categories = await GlobalControlTemplate.aggregate([
    { $match: { isActive: true, controlGroup: { $ne: null, $ne: '' } } },
    { $group: { _id: '$controlGroup', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { controlGroup: '$_id', count: 1, _id: 0 } },
  ]);

  return categories;
};

export default {
  getTemplates,
  getTemplateById,
  getTemplatesByFramework,
  getCategories,
};
