function getOrgIdFromQuery(query) {
  const mongooseOptions = query.mongooseOptions?.() || {};
  const queryOptions = query.getOptions?.() || {};

  return mongooseOptions._orgId ?? queryOptions._orgId;
}

function applyOrgFilter(query, fieldName) {
  const orgId = getOrgIdFromQuery(query);

  if (!orgId) {
    return;
  }

  query.where({ [fieldName]: orgId });
}

function applyOrgScopeToAggregate(aggregate, fieldName) {
  const orgId = aggregate.options?._orgId;

  if (!orgId) {
    return;
  }

  const pipeline = aggregate.pipeline();
  const orgMatch = { [fieldName]: orgId };
  const firstStage = pipeline[0];

  if (firstStage?.$geoNear || firstStage?.$search || firstStage?.$vectorSearch) {
    pipeline.splice(1, 0, { $match: orgMatch });
    return;
  }

  pipeline.unshift({ $match: orgMatch });
}

/**
 * Adds opt-in organization scoping to a Mongoose schema.
 *
 * Use `.forOrg(orgId)` on standard queries. Aggregate queries can opt in with
 * `.option({ _orgId: orgId })`.
 *
 * @param {import('mongoose').Schema} schema
 * @param {string} fieldName
 */
export function applyOrgScope(schema, fieldName = 'organization') {
  schema.query.forOrg = function (orgId) {
    this.setOptions({ _orgId: orgId });
    return this;
  };

  schema.pre(['find', 'findOne', 'countDocuments'], function () {
    applyOrgFilter(this, fieldName);
  });

  schema.pre('aggregate', function () {
    applyOrgScopeToAggregate(this, fieldName);
  });
}

export default applyOrgScope;
