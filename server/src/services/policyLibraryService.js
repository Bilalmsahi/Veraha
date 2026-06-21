/**
 * Policy Library Service
 * Vanta-style policy template library and add-from-library
 */
import PolicyTemplate from '../models/PolicyTemplate.js';
import Policy from '../models/Policy.js';
import PolicyVersion from '../models/PolicyVersion.js';
import Framework from '../models/Framework.js';
import { POLICY_STATUS } from '../models/enums.js';
import { hashPolicyHtml, sanitizePolicyHtml } from '../utils/policyHtmlSanitizer.js';
/**
 * Get policy library templates with optional filters and "added" status per org
 */
export const getPolicyLibrary = async (orgId, filters) => {
  const { search, frameworkCode, added, page = 1, limit = 50 } = filters;

  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (frameworkCode) {
    query.frameworkCodes = frameworkCode.toUpperCase();
  }

  const templates = await PolicyTemplate.find(query)
    .sort({ title: 1 })
    .lean();

  // Get org policies that have templateId set (map templateId -> policyId for "View" when added)
  const orgPolicies = await Policy.find({
    organizationId: orgId,
    isDeleted: false,
    templateId: { $ne: null },
  })
    .select('_id templateId')
    .lean();

  const templateToPolicyId = new Map(
    orgPolicies
      .filter((p) => p.templateId)
      .map((p) => [p.templateId.toString(), p._id.toString()])
  );
  const addedTemplateIds = new Set(templateToPolicyId.keys());

  let result = templates.map((t) => ({
    ...t,
    added: addedTemplateIds.has(t._id.toString()),
    policyId: templateToPolicyId.get(t._id.toString()),
  }));

  if (added === 'true') {
    result = result.filter((r) => r.added);
  } else if (added === 'false') {
    result = result.filter((r) => !r.added);
  }

  const total = result.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (clampedPage - 1) * limit;
  const paginated = result.slice(start, start + limit);

  // Populate framework names
  const frameworks = await Framework.find({}).lean();
  const frameworkByCode = new Map(frameworks.map((f) => [f.code, f]));

  const enriched = paginated.map((t) => ({
    ...t,
    frameworks: (t.frameworkCodes || []).map((code) => ({
      code,
      name: frameworkByCode.get(code)?.name || code,
    })),
  }));

  return {
    templates: enriched,
    pagination: {
      page: clampedPage,
      limit,
      total,
      pages,
      hasNextPage: clampedPage < pages,
      hasPrevPage: clampedPage > 1,
    },
  };
};

/**
 * Add policy from library template to org
 */
export const addPolicyFromLibrary = async (templateId, orgId, userId) => {
  const template = await PolicyTemplate.findById(templateId);
  if (!template) {
    const error = new Error('Policy template not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if already added
  const existing = await Policy.findOne({
    organizationId: orgId,
    templateId,
    isDeleted: false,
  });
  if (existing) {
    const error = new Error('This policy template has already been added to your organization');
    error.statusCode = 400;
    throw error;
  }

  const policy = await Policy.create({
    organizationId: orgId,
    templateId: template._id,
    source: 'VANTA',
    title: template.title,
    description: template.description || '',
    category: template.category || 'General',
    status: POLICY_STATUS[0], // DRAFT
    ownerId: userId,
    reviewFrequency: 'ANNUALLY',
    requiresAttestation: true,
    frameworkIds: [], // Will resolve below
  });

  // Resolve frameworkIds from template.frameworkCodes
  const frameworks = await Framework.find({ code: { $in: template.frameworkCodes || [] } });
  policy.frameworkIds = frameworks.map((f) => f._id);
  await policy.save();

  // Create initial draft version (no file - user uploads later)
  const initialContentHtml = sanitizePolicyHtml(
    `<h1>${template.title}</h1><p>${template.description || ''}</p><p><em>Based on template: ${template.filename}</em></p>`
  );

  const version = await PolicyVersion.create({
    organizationId: orgId,
    policyId: policy._id,
    versionNumber: 1,
    status: POLICY_STATUS[0], // DRAFT
    contentHtml: initialContentHtml,
    contentType: 'EDITOR_HTML',
    contentHash: hashPolicyHtml(initialContentHtml),
    editorLastSavedAt: new Date(),
    editorLastSavedBy: userId,
    changelog: 'Initial version from policy library',
    createdBy: userId,
  });

  await policy.populate('ownerId', 'firstName lastName email');
  await policy.populate('linkedControlIds', 'identifier title');
  await policy.populate('frameworkIds', 'code name');
  await policy.populate('templateId', 'slug title filename');

  return policy;
};

export default {
  getPolicyLibrary,
  addPolicyFromLibrary,
};
