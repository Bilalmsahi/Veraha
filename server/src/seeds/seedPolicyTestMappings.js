/**
 * Seed Policy <-> Test mappings from JSON files.
 *
 * Required files (copy into server/src/seeds/data/):
 * - approval_policy_test_mappings.json
 * - assignment_policy_test_mappings.json
 *
 * Idempotent:
 * - Policies upsert by (organizationId + title)
 * - Tests upsert by (organizationId + notionId)
 *
 * JSON row shape (both files):
 * {
 *   "notionId": "some-stable-id",
 *   "testName": "Quarterly access review completed",
 *   "testType": "document" | "automated",
 *   "testCategory": "Engineering" | "Human resources" | "Policy" | "Risks" | "Legal" | "Finance" | "Management" | "Other",
 *   "policyTitle": "Access Control Policy",
 *   "policyCategory": "Security",
 *   "controlIdentifiers": ["CC6.1", "CC6.2"] // optional
 * }
 *
 * Usage:
 *   node src/seeds/seedPolicyTestMappings.js
 *   node src/seeds/seedPolicyTestMappings.js --dry-run
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const serverEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
const rootEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: serverEnv });
dotenv.config({ path: rootEnv });

import '../models/index.js';
import Organization from '../models/Organization.js';
import InternalControl from '../models/InternalControl.js';
import Policy from '../models/Policy.js';
import PolicyVersion from '../models/PolicyVersion.js';
import Test from '../models/Test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const DRY_RUN = process.argv.includes('--dry-run');

const DATA_DIR = path.join(__dirname, 'data');
const APPROVAL_FILE = path.join(DATA_DIR, 'approval_policy_test_mappings.json');
const ASSIGNMENT_FILE = path.join(DATA_DIR, 'assignment_policy_test_mappings.json');

function log(msg, icon = 'ℹ️ ') {
  console.log(`${icon}  ${msg}`);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing mapping file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function ensurePolicy({ organizationId, actorUserId, title, category }) {
  const policy = await Policy.findOneAndUpdate(
    { organizationId, title: title.trim(), isDeleted: { $ne: true } },
    {
      $set: {
        organizationId,
        title: title.trim(),
        category: category?.trim() || '',
        status: 'DRAFT',
        workflowStatus: 'DRAFT',
        ownerId: actorUserId,
      },
      $setOnInsert: {
        requiresAttestation: true,
        linkedControlIds: [],
        frameworkIds: [],
        source: 'CUSTOM',
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Ensure a v1 PolicyVersion exists (draft) so the policy detail page has content.
  await PolicyVersion.findOneAndUpdate(
    { organizationId, policyId: policy._id, versionNumber: 1 },
    {
      $setOnInsert: {
        organizationId,
        policyId: policy._id,
        versionNumber: 1,
        status: 'DRAFT',
        workflowStatus: 'DRAFT',
        createdBy: actorUserId,
        changelog: 'Seeded placeholder version',
        contentHtml: `<h1>${policy.title}</h1><p>Seeded policy placeholder. Replace with real content.</p>`,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return policy;
}

async function ensureTest({ organizationId, notionId, testName, testType, testCategory }) {
  const doc = await Test.findOneAndUpdate(
    { organizationId, notionId, isDeleted: { $ne: true } },
    {
      $set: {
        organizationId,
        notionId,
        name: testName?.trim() || notionId,
        type: testType || 'document',
        category: testCategory || 'Engineering',
        isActive: true,
        snoozedUntil: null,
      },
      $setOnInsert: {
        status: 'ok',
        linkedControlIds: [],
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return doc;
}

async function resolveControls({ organizationId, controlIdentifiers }) {
  if (!Array.isArray(controlIdentifiers) || controlIdentifiers.length === 0) return [];
  const controls = await InternalControl.find({
    organizationId,
    isDeleted: { $ne: true },
    identifier: { $in: controlIdentifiers },
  })
    .select('_id identifier')
    .lean();
  return controls.map((c) => c._id);
}

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  Policy/Test Mapping Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  log(`Connected to ${MONGO_URI}`, '🔗');

  const orgs = await Organization.find({ isDeleted: { $ne: true } }).lean();
  if (!orgs.length) {
    console.error('❌  No organizations found. Create a tenant first.');
    process.exit(1);
  }

  const approval = loadJson(APPROVAL_FILE);
  const assignment = loadJson(ASSIGNMENT_FILE);
  const rows = [...approval, ...assignment];

  log(`Loaded ${approval.length} approval rows, ${assignment.length} assignment rows`, '📄');

  for (const org of orgs) {
    log(`Seeding org: ${org.name} (${org._id})`, '📦');

    // Choose a reasonable "actor" for seeded createdBy fields (first ADMIN else any user)
    const actor = await mongoose
      .model('User')
      .findOne({ organizationId: org._id, isDeleted: { $ne: true }, role: 'ADMIN' })
      .select('_id')
      .lean();
    const actorUserId = actor?._id;

    if (!actorUserId) {
      log('No ADMIN user found for org; skipping policy/version createdBy fields.', '⚠️ ');
    }

    let touched = 0;

    for (const row of rows) {
      if (!row?.notionId || !row?.testName || !row?.policyTitle) continue;

      if (DRY_RUN) {
        touched++;
        continue;
      }

      const policy = await ensurePolicy({
        organizationId: org._id,
        actorUserId,
        title: row.policyTitle,
        category: row.policyCategory,
      });

      const test = await ensureTest({
        organizationId: org._id,
        notionId: row.notionId,
        testName: row.testName,
        testType: row.testType,
        testCategory: row.testCategory,
      });

      const controlIds = await resolveControls({
        organizationId: org._id,
        controlIdentifiers: row.controlIdentifiers,
      });

      // Link controls to policy/test and also link policy to controls for sidebar UX.
      if (controlIds.length) {
        await Policy.updateOne(
          { _id: policy._id },
          { $addToSet: { linkedControlIds: { $each: controlIds } } }
        );
        await Test.updateOne(
          { _id: test._id },
          { $addToSet: { linkedControlIds: { $each: controlIds } } }
        );
        await InternalControl.updateMany(
          { _id: { $in: controlIds } },
          { $addToSet: { linkedPolicyIds: policy._id } }
        );
      }

      touched++;
    }

    if (DRY_RUN) log(`DRY RUN — would process ${touched} mapping rows`, '⚠️ ');
    else log(`Processed ${touched} mapping rows`, '✅');
  }

  await mongoose.connection.close();
  log('Done.', '✅');
}

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});

