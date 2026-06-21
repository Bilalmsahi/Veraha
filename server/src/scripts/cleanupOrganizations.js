import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelRegistry } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const SERVER_SELECTION_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 12_000;

const GLOBAL_MODELS = new Set([
  'Framework',
  'RequirementCategory',
  'Requirement',
  'GlobalControlTemplate',
  'GlobalTestTemplate',
  'PolicyTemplate',
  'AuditorProfile',
]);

function parseArgs(argv) {
  const args = {
    list: false,
    execute: false,
    keepIds: [],
  };

  for (const arg of argv) {
    if (arg === '--list') {
      args.list = true;
      continue;
    }

    if (arg === '--execute') {
      args.execute = true;
      continue;
    }

    if (arg.startsWith('--keep=')) {
      args.keepIds = arg
        .slice('--keep='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }

  return args;
}

function usage() {
  console.log(`
Usage:
  node src/scripts/cleanupOrganizations.js --list
  node src/scripts/cleanupOrganizations.js --keep=<ORG_ID_1>,<ORG_ID_2>
  node src/scripts/cleanupOrganizations.js --keep=<ORG_ID_1>,<ORG_ID_2> --execute

Notes:
  - Delete mode is a dry run unless --execute is provided.
  - Delete mode requires exactly two valid organization IDs to keep.
  - Global seed collections are never deleted by this script.
`);
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function uniqueObjectIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    const key = id.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateKeepIds(rawIds) {
  if (rawIds.length !== 2) {
    throw new Error(`Delete mode requires exactly two keep IDs. Received ${rawIds.length}.`);
  }

  const uniqueIds = [...new Set(rawIds)];
  if (uniqueIds.length !== 2) {
    throw new Error('Keep IDs must be two different organization IDs.');
  }

  const invalidIds = uniqueIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid organization ID(s): ${invalidIds.join(', ')}`);
  }

  return uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
}

async function listOrganizations() {
  const organizations = await ModelRegistry.Organization.find({})
    .select('_id name domain slug status createdAt')
    .sort({ createdAt: 1, name: 1 })
    .lean();

  console.log(`\nOrganizations (${organizations.length})`);
  console.log('='.repeat(120));

  if (organizations.length === 0) {
    console.log('No organizations found.');
    return organizations;
  }

  for (const org of organizations) {
    console.log(
      [
        org._id.toString(),
        `name=${JSON.stringify(formatValue(org.name))}`,
        `domain=${JSON.stringify(formatValue(org.domain))}`,
        `slug=${JSON.stringify(formatValue(org.slug))}`,
        `status=${JSON.stringify(formatValue(org.status))}`,
        `createdAt=${formatValue(org.createdAt)}`,
      ].join(' | ')
    );
  }

  return organizations;
}

function getDirectOrgTargets() {
  return Object.entries(ModelRegistry)
    .filter(([modelName, model]) => {
      if (!model?.schema || modelName === 'Organization' || GLOBAL_MODELS.has(modelName)) {
        return false;
      }
      return model.schema.path('organizationId') || model.schema.path('organization');
    })
    .map(([modelName, model]) => ({
      modelName,
      collectionName: model.collection.name,
      field: model.schema.path('organizationId') ? 'organizationId' : 'organization',
      collection: model.collection,
    }))
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

async function getDeletionContext(deleteOrgIds) {
  const [
    userIds,
    policyIds,
    policyVersionIds,
    riskIds,
    auditIds,
    controlIds,
  ] = await Promise.all([
    ModelRegistry.User.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
    ModelRegistry.Policy.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
    ModelRegistry.PolicyVersion.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
    ModelRegistry.Risk.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
    ModelRegistry.Audit.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
    ModelRegistry.InternalControl.distinct('_id', { organizationId: { $in: deleteOrgIds } }),
  ]);

  return {
    userIds: uniqueObjectIds(userIds),
    policyIds: uniqueObjectIds(policyIds),
    policyVersionIds: uniqueObjectIds(policyVersionIds),
    riskIds: uniqueObjectIds(riskIds),
    auditIds: uniqueObjectIds(auditIds),
    controlIds: uniqueObjectIds(controlIds),
  };
}

function getSpecialTargets(context) {
  return [
    {
      label: 'RefreshToken',
      collection: ModelRegistry.RefreshToken.collection,
      filter: { user: { $in: context.userIds } },
    },
    {
      label: 'PolicyAttestation',
      collection: ModelRegistry.PolicyAttestation.collection,
      filter: {
        $or: [
          { userId: { $in: context.userIds } },
          { policyVersionId: { $in: context.policyVersionIds } },
        ],
      },
    },
    {
      label: 'RiskAssessment',
      collection: ModelRegistry.RiskAssessment.collection,
      filter: {
        $or: [
          { riskId: { $in: context.riskIds } },
          { assessedById: { $in: context.userIds } },
        ],
      },
    },
    {
      label: 'AuditControlSnapshot',
      collection: ModelRegistry.AuditControlSnapshot.collection,
      filter: {
        $or: [
          { auditId: { $in: context.auditIds } },
          { originalControlId: { $in: context.controlIds } },
        ],
      },
    },
  ];
}

async function summarizeTargets(directTargets, specialTargets, deleteOrgIds) {
  const rows = [];

  for (const target of directTargets) {
    const filter = { [target.field]: { $in: deleteOrgIds } };
    const count = await target.collection.countDocuments(filter);
    rows.push({
      label: target.modelName,
      collectionName: target.collectionName,
      count,
      filter,
      collection: target.collection,
    });
  }

  for (const target of specialTargets) {
    const count = await target.collection.countDocuments(target.filter);
    rows.push({
      label: target.label,
      collectionName: target.collection.name,
      count,
      filter: target.filter,
      collection: target.collection,
    });
  }

  const organizationFilter = { _id: { $in: deleteOrgIds } };
  rows.push({
    label: 'Organization',
    collectionName: ModelRegistry.Organization.collection.name,
    count: await ModelRegistry.Organization.collection.countDocuments(organizationFilter),
    filter: organizationFilter,
    collection: ModelRegistry.Organization.collection,
  });

  return rows.filter((row) => row.count > 0);
}

function printOrgSet(title, organizations) {
  console.log(`\n${title} (${organizations.length})`);
  console.log('-'.repeat(120));

  if (organizations.length === 0) {
    console.log('None');
    return;
  }

  for (const org of organizations) {
    console.log(`${org._id} | ${org.name || '-'} | ${org.domain || '-'} | ${org.slug || '-'} | ${org.status || '-'}`);
  }
}

function printDeletePlan(rows) {
  console.log('\nPer-collection delete counts');
  console.log('-'.repeat(120));

  if (rows.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  for (const row of rows) {
    console.log(`${row.label.padEnd(36)} ${String(row.count).padStart(8)}  ${row.collectionName}`);
  }
}

async function runCleanup({ keepIds, execute }) {
  const keepObjectIds = validateKeepIds(keepIds);
  const allOrganizations = await ModelRegistry.Organization.find({})
    .select('_id name domain slug status createdAt')
    .sort({ createdAt: 1, name: 1 })
    .lean();

  const keepIdSet = new Set(keepObjectIds.map((id) => id.toString()));
  const keptOrganizations = allOrganizations.filter((org) => keepIdSet.has(org._id.toString()));
  const deleteOrganizations = allOrganizations.filter((org) => !keepIdSet.has(org._id.toString()));

  if (keptOrganizations.length !== 2) {
    const found = keptOrganizations.map((org) => org._id.toString());
    const missing = keepIds.filter((id) => !found.includes(id));
    throw new Error(`Refusing to continue. Missing keep organization ID(s): ${missing.join(', ')}`);
  }

  const deleteOrgIds = deleteOrganizations.map((org) => org._id);
  const context = await getDeletionContext(deleteOrgIds);
  const directTargets = getDirectOrgTargets();
  const specialTargets = getSpecialTargets(context);
  const rows = await summarizeTargets(directTargets, specialTargets, deleteOrgIds);

  printOrgSet('Organizations to keep', keptOrganizations);
  printOrgSet('Organizations to delete', deleteOrganizations);
  printDeletePlan(rows);

  if (!execute) {
    console.log('\nDRY RUN ONLY. Re-run with --execute to permanently delete these records.');
    return;
  }

  console.log('\nEXECUTE MODE. Permanently deleting records...');

  for (const row of rows) {
    const result = await row.collection.deleteMany(row.filter);
    console.log(`${row.label.padEnd(36)} deleted ${result.deletedCount}`);
  }

  const remainingOrganizations = await ModelRegistry.Organization.countDocuments();
  console.log(`\nCleanup complete. Remaining organizations: ${remainingOrganizations}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listOrganizations();
    return;
  }

  if (args.keepIds.length > 0) {
    await runCleanup(args);
    return;
  }

  usage();
}

mongoose.set('strictQuery', true);

async function connectWithTimeout() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`MongoDB connection timed out after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);
  });

  return Promise.race([
    mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
    }),
    timeout,
  ]);
}

async function run() {
  try {
    await connectWithTimeout();
    await main();
    await mongoose.disconnect();
  } catch (error) {
    console.error(`\nOrganization cleanup failed: ${error.message}`);
    process.exit(1);
  }
}

run();
