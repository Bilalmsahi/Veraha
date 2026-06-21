/**
 * Assign policies to groups using explicit keyword matching rules.
 *
 * Rules (per product requirements):
 * - BOARD_MEMBERS: receive NO assignments (never add board-members to policy assignments)
 * - ISMS_BODY: receives ALL assignments (always included for every policy)
 * - ENGINEERING_TEAM: match engineering/dev/infra keywords
 * - HR_TEAM: match HR/personnel keywords
 * - GENERAL_STAFF: default bucket for everything else (excluding ISMS-only/security-only content)
 * - ALL_PERSONNEL: not used for "specific group" assignment (reserved for Phase 3 publish modal choice)
 *
 * Usage:
 *   node src/seeds/assignPoliciesToGroups.js
 *   node src/seeds/assignPoliciesToGroups.js --dry-run
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
import Policy from '../models/Policy.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg, icon = 'ℹ️ ') {
  console.log(`${icon}  ${msg}`);
}

function norm(s) {
  return (s || '').toLowerCase();
}

const KEYWORDS = {
  engineering: [
    'engineering',
    'developer',
    'development',
    'devops',
    'infrastructure',
    'infra',
    'cloud',
    'ci/cd',
    'cicd',
    'deployment',
    'source code',
    'github',
    'access keys',
    'secrets',
    'logging',
    'monitoring',
    'backup',
    'incident',
    'vulnerability',
    'patch',
  ],
  hr: [
    'human resources',
    'hr',
    'personnel',
    'hiring',
    'recruit',
    'onboarding',
    'offboarding',
    'termination',
    'training',
    'background',
    'employee',
    'workforce',
    'code of conduct',
  ],
  ismsOnly: [
    // If the policy is deeply ISMS/GRC-specific, we avoid assigning it to GENERAL_STAFF by default.
    'isms',
    'iso 27001',
    'soc 2',
    'gdpr',
    'hipaa',
    'risk register',
    'control mapping',
    'audit evidence',
    'audit',
    'internal audit',
  ],
};

function computeTargets(policyTitle) {
  const t = norm(policyTitle);

  const isEngineering = KEYWORDS.engineering.some((k) => t.includes(k));
  const isHr = KEYWORDS.hr.some((k) => t.includes(k));
  const isIsmsOnly = KEYWORDS.ismsOnly.some((k) => t.includes(k));

  /** ISMS body always included. Board never included. */
  const targets = new Set(['isms-body']);

  if (isEngineering) targets.add('engineering-team');
  if (isHr) targets.add('hr-team');

  // Default bucket: general staff for "normal" policies
  if (!isIsmsOnly && !isEngineering && !isHr) {
    targets.add('general-staff');
  }

  return [...targets];
}

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  Policy -> Group Assignment Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  log(`Connected to ${MONGO_URI}`, '🔗');

  const orgs = await Organization.find({ isDeleted: { $ne: true } }).lean();
  if (!orgs.length) {
    console.error('❌  No organizations found. Create a tenant first.');
    process.exit(1);
  }

  for (const org of orgs) {
    log(`Org: ${org.name} (${org._id})`, '📦');

    // Need seeded groups first
    const groups = await Group.find({ organizationId: org._id, isDeleted: { $ne: true } })
      .select('_id slug type')
      .lean();
    const bySlug = new Map(groups.map((g) => [g.slug, g]));

    const requiredSlugs = ['isms-body', 'engineering-team', 'hr-team', 'general-staff', 'board-members'];
    const missing = requiredSlugs.filter((s) => !bySlug.has(s));
    if (missing.length) {
      log(`Missing groups: ${missing.join(', ')}. Run seedGroups first.`, '❌');
      continue;
    }

    const policies = await Policy.find({ organizationId: org._id, isDeleted: { $ne: true } })
      .select('_id title assignmentScope assignmentGroupIds')
      .lean();

    let updated = 0;

    for (const p of policies) {
      const slugs = computeTargets(p.title);
      const groupIds = slugs
        .map((s) => bySlug.get(s)?._id)
        .filter(Boolean);

      if (DRY_RUN) continue;

      // Assign as SPECIFIC_GROUPS and set group ids. Board members are never included by computeTargets.
      await Policy.updateOne(
        { _id: p._id },
        {
          $set: {
            assignmentScope: 'SPECIFIC_GROUPS',
            assignmentGroupIds: groupIds,
          },
        }
      );
      updated++;
    }

    if (DRY_RUN) log(`DRY RUN — would update ${policies.length} policies`, '⚠️ ');
    else log(`Updated ${updated} policies`, '✅');
  }

  await mongoose.connection.close();
  log('Done.', '✅');
}

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});

