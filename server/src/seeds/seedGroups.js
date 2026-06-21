/**
 * Seed default Groups for each tenant Organization.
 *
 * Idempotent: upserts by (organizationId + slug), with partial unique index on Group.
 *
 * Usage:
 *   node src/seeds/seedGroups.js
 *   node src/seeds/seedGroups.js --dry-run
 *
 * Notes:
 * - Creates canonical default groups:
 *   All Personnel, Board Members, ISMS Body, General Staff, Engineering Team, HR Team
 * - You can edit names/slugs later; slugs are the stable key for upsert.
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
import Group from '../models/Group.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg, icon = 'ℹ️ ') {
  console.log(`${icon}  ${msg}`);
}

const DEFAULT_GROUPS = [
  { type: 'ALL_PERSONNEL', name: 'All Personnel', slug: 'all-personnel' },
  { type: 'BOARD_MEMBERS', name: 'Board Members', slug: 'board-members' },
  { type: 'ISMS_BODY', name: 'ISMS Body', slug: 'isms-body' },
  { type: 'GENERAL_STAFF', name: 'General Staff', slug: 'general-staff' },
  { type: 'ENGINEERING_TEAM', name: 'Engineering Team', slug: 'engineering-team' },
  { type: 'HR_TEAM', name: 'HR Team', slug: 'hr-team' },
];

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  Default Groups Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  log(`Connected to ${MONGO_URI}`, '🔗');

  const orgs = await Organization.find({ isDeleted: { $ne: true } }).lean();
  if (!orgs.length) {
    console.error('❌  No organizations found. Create a tenant first.');
    process.exit(1);
  }

  log(`Found ${orgs.length} organization(s) — seeding all`, '📦');

  for (const org of orgs) {
    log(`Seeding org: ${org.name} (${org._id})`, '📦');

    if (DRY_RUN) {
      log(`DRY RUN — would upsert ${DEFAULT_GROUPS.length} groups`, '⚠️ ');
      continue;
    }

    let created = 0;
    let updated = 0;

    for (const g of DEFAULT_GROUPS) {
      const doc = await Group.findOneAndUpdate(
        { organizationId: org._id, slug: g.slug, isDeleted: { $ne: true } },
        {
          $set: {
            organizationId: org._id,
            type: g.type,
            name: g.name,
            slug: g.slug,
            description: '',
          },
          $setOnInsert: {
            memberUserIds: [],
            isDeleted: false,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      if (doc.createdAt.getTime() === doc.updatedAt.getTime()) created++;
      else updated++;
    }

    log(`  → ${created} created, ${updated} updated`, '✅');
  }

  log('Done.', '✅');
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});

