/**
 * Sample Tests — seedSampleTests.js
 *
 * Inserts a handful of compliance Test records for UI / picker / control-link flows.
 * Idempotent: upserts by (organizationId + notionId).
 *
 * Usage:
 *   node src/seeds/seedSampleTests.js
 *   npm run seed:tests:sample
 *
 * Expects at least one Organization and (ideally) InternalControl rows — e.g. after
 * npm run seed:demo (or any tenant with controls).
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const serverEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
const rootEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: serverEnv });
dotenv.config({ path: rootEnv });

import '../models/index.js';
import Organization from '../models/Organization.js';
import InternalControl from '../models/InternalControl.js';
import Test from '../models/Test.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';

const SAMPLE_NOTION_PREFIX = 'sample-ui-test-';

function log(msg, icon = 'ℹ️ ') {
  console.log(`${icon}  ${msg}`);
}

const SAMPLES = [
  {
    suffix: 'access-review',
    name: 'Quarterly access review completed',
    description: 'Evidence that user access lists were reviewed each quarter.',
    category: 'Engineering',
    type: 'document',
    renewalPeriod: 'quarterly',
    dueDaysFromNow: 45,
    linkToControlIndex: 0,
  },
  {
    suffix: 'mfa-enforcement',
    name: 'MFA enforced for all workforce identities',
    description: 'Automated check that SSO/MFA policies cover all human accounts.',
    category: 'Engineering',
    type: 'automated',
    renewalPeriod: 'monthly',
    dueDaysFromNow: 12,
    linkToControlIndex: 1,
  },
  {
    suffix: 'vendor-dpa',
    name: 'Vendor DPAs on file',
    category: 'Legal',
    type: 'document',
    renewalPeriod: 'annually',
    dueDaysFromNow: -5,
    linkToControlIndex: null,
  },
  {
    suffix: 'security-training',
    name: 'Annual security awareness training',
    category: 'Human resources',
    type: 'document',
    renewalPeriod: 'annually',
    dueDaysFromNow: 8,
    linkToControlIndex: 0,
  },
  {
    suffix: 'backup-restore-drill',
    name: 'Backup restore drill documented',
    category: 'Engineering',
    type: 'document',
    renewalPeriod: 'annually',
    dueDaysFromNow: 120,
    linkToControlIndex: 2,
  },
  {
    suffix: 'incident-tabletop',
    name: 'Incident response tabletop exercise',
    category: 'Management',
    type: 'document',
    renewalPeriod: 'annually',
    dueDaysFromNow: 200,
    linkToControlIndex: null,
  },
];

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  Sample Tests Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  log(`Connected to ${MONGO_URI}`, '🔗');

  const orgs = await Organization.find({ isDeleted: { $ne: true } }).lean();

  if (!orgs.length) {
    console.error('❌  No organizations found. Create a tenant first.');
    process.exit(1);
  }

  log(`Found ${orgs.length} organization(s) — seeding all`, '📦');

  const now = new Date();
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const org of orgs) {
    log(`Seeding org: ${org.name} (${org._id})`, '📦');

    const controls = await InternalControl.find({
      organizationId: org._id,
      isDeleted: { $ne: true },
    })
      .select('_id')
      .limit(5)
      .lean();

    const controlIds = controls.map((c) => c._id);

    let created = 0;
    let updated = 0;

    for (const row of SAMPLES) {
      const notionId = `${SAMPLE_NOTION_PREFIX}${row.suffix}`;
      const dueDate = new Date(now.getTime() + row.dueDaysFromNow * 86400000);

      const linkedControlIds = [];
      if (row.linkToControlIndex != null && controlIds[row.linkToControlIndex]) {
        linkedControlIds.push(controlIds[row.linkToControlIndex]);
      }

      const doc = await Test.findOneAndUpdate(
        { organizationId: org._id, notionId },
        {
          $set: {
            name: row.name,
            description: row.description,
            category: row.category,
            type: row.type,
            renewalPeriod: row.renewalPeriod,
            dueDate,
            isActive: true,
            snoozedUntil: null,
            linkedControlIds,
            instructions: 'Upload evidence or connect automation when available.',
            evidenceGuidance: 'Screenshots, exports, or policy links are acceptable for manual review.',
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );

      if (doc.createdAt.getTime() === doc.updatedAt.getTime()) created++;
      else updated++;
    }

    log(`  → ${created} created, ${updated} updated`, '✅');
    totalCreated += created;
    totalUpdated += updated;
  }

  log(`Total: ${totalCreated} created, ${totalUpdated} updated across ${orgs.length} org(s)`, '✅');
  console.log('\n' + '='.repeat(55));
  console.log('  Open /tests and control sidebar → Tests to verify.');
  console.log('='.repeat(55) + '\n');

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
