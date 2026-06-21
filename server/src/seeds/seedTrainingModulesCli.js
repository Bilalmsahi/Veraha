/**
 * Seed security awareness training modules (HIPAA, ISO27001/SOC2, GDPR) for tenant org(s).
 *
 * Usage:
 *   node src/seeds/seedTrainingModulesCli.js
 *   node src/seeds/seedTrainingModulesCli.js --dry-run
 *   node src/seeds/seedTrainingModulesCli.js --org-id=<organizationId>
 *
 * From repo root:
 *   npm run seed:training --prefix server
 *   npm run seed:training --prefix server -- --org-id=YOUR_ORG_ID
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
import { seedTrainingModulesForOrganization } from './seedTrainingModules.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const DRY_RUN = process.argv.includes('--dry-run');
const orgIdArg = process.argv.find((arg) => arg.startsWith('--org-id='));
const ORG_ID = orgIdArg ? orgIdArg.split('=')[1] : null;

function log(msg, icon = 'ℹ️ ') {
  console.log(`${icon}  ${msg}`);
}

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  Training Modules Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  log(`Connected to ${MONGO_URI}`, '🔗');

  const filter = { isDeleted: { $ne: true } };
  if (ORG_ID) filter._id = ORG_ID;

  const orgs = await Organization.find(filter).lean();
  if (!orgs.length) {
    console.error('❌  No organizations found.');
    if (ORG_ID) console.error(`    Check --org-id=${ORG_ID}`);
    process.exit(1);
  }

  log(`Found ${orgs.length} organization(s)`, '📦');

  for (const org of orgs) {
    log(`Org: ${org.name} (${org._id})`, '🏢');

    if (DRY_RUN) {
      log('DRY RUN — would seed 3 modules (HIPAA, ISO27001/SOC2, GDPR)', '⚠️ ');
      continue;
    }

    const result = await seedTrainingModulesForOrganization(org._id);
    log(`Created: ${result.created}, skipped: ${result.skipped}, total: ${result.total}`, '✅');
  }

  console.log('\nDone. Refresh Personnel → My tasks to see training rows.\n');
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});