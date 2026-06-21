/**
 * SOC 2 Test Seed — seedSOC2Test.js
 *
 * Inserts a small set of SOC 2 RequirementCategories and Requirements so the
 * new Framework Detail page can be tested visually without touching any existing
 * seed files.
 *
 * Usage:
 *   node src/seeds/seedSOC2Test.js
 *   node src/seeds/seedSOC2Test.js --fresh   (drops test categories & requirements first)
 *
 * Safe to re-run — all writes are upserts keyed on (frameworkId, code) for
 * categories and (frameworkId, identifier) for requirements.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Try server/.env first, fall back to repo root .env
const serverEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
const rootEnv   = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: serverEnv });
dotenv.config({ path: rootEnv });

import '../models/index.js';
import Framework from '../models/Framework.js';
import RequirementCategory from '../models/RequirementCategory.js';
import Requirement from '../models/Requirement.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
const FRESH = process.argv.includes('--fresh');

// ─── TEST DATA ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { code: 'CC5', title: 'Control Activities',            order: 10 },
  { code: 'CC6', title: 'Logical and Physical Access',   order: 20 },
  { code: 'CC7', title: 'System Operations',             order: 30 },
  { code: 'A1',  title: 'Availability Criteria',         order: 40 },
];

// categoryCode must match a code above
const REQUIREMENTS = [
  // CC5 — Control Activities
  { identifier: 'CC 5.1', categoryCode: 'CC5', title: 'COSO Principle 10: Control Activities',         description: 'The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives.' },
  { identifier: 'CC 5.2', categoryCode: 'CC5', title: 'COSO Principle 11: General Controls over Tech', description: 'The entity selects and develops general control activities over technology to support the achievement of objectives.' },
  { identifier: 'CC 5.3', categoryCode: 'CC5', title: 'COSO Principle 12: Policies and Procedures',    description: 'The entity deploys control activities through policies that establish what is expected and procedures that put policies into action.' },

  // CC6 — Logical and Physical Access
  { identifier: 'CC 6.1', categoryCode: 'CC6', title: 'Logical Access Security',      description: 'The entity implements logical access security software, infrastructure, and architectures.' },
  { identifier: 'CC 6.2', categoryCode: 'CC6', title: 'User Access Provisioning',     description: 'Prior to issuing system credentials, the entity registers and authorizes new users.' },
  { identifier: 'CC 6.3', categoryCode: 'CC6', title: 'Access Changes and Removal',   description: 'The entity authorizes, modifies, or removes access to data, software, functions, and other protected assets.' },
  { identifier: 'CC 6.4', categoryCode: 'CC6', title: 'Physical Access',              description: 'The entity restricts physical access to facilities and protected information assets.' },
  { identifier: 'CC 6.6', categoryCode: 'CC6', title: 'External Threats',             description: 'The entity implements logical access security measures to protect against threats from sources outside its system boundaries.' },
  { identifier: 'CC 6.7', categoryCode: 'CC6', title: 'Data Transmission',            description: 'The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes.' },

  // CC7 — System Operations
  { identifier: 'CC 7.1', categoryCode: 'CC7', title: 'Detection and Monitoring',  description: 'The entity uses detection and monitoring procedures to identify changes to configurations or new vulnerabilities.' },
  { identifier: 'CC 7.2', categoryCode: 'CC7', title: 'Monitoring Anomalies',      description: 'The entity monitors system components and the operation of those components for anomalies.' },
  { identifier: 'CC 7.3', categoryCode: 'CC7', title: 'Incident Response',         description: 'The entity responds to security incidents by containing the incident and isolating affected systems.' },

  // A1 — Availability
  { identifier: 'A 1.1', categoryCode: 'A1', title: 'Availability Capacity Management',     description: 'The entity maintains, monitors, and evaluates current processing capacity and use of system components.' },
  { identifier: 'A 1.2', categoryCode: 'A1', title: 'Availability Environmental Protections', description: 'The entity authorizes, designs, develops, implements, and maintains environmental protections.' },
  { identifier: 'A 1.3', categoryCode: 'A1', title: 'Availability Data Backup and Recovery',  description: 'The entity tests recovery plan procedures to support the availability of information.' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function log(msg, icon = 'ℹ️ ') { console.log(`${icon}  ${msg}`); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  SOC 2 Test Seeder');
  console.log('='.repeat(55) + '\n');

  await mongoose.connect(MONGO_URI);
  log(`Connected to ${MONGO_URI}`, '🔗');

  // 1. Resolve SOC2 framework
  const framework = await Framework.findOne({ code: 'SOC2', isActive: true });
  if (!framework) {
    console.error('❌  SOC2 framework not found. Run the main seed first (npm run seed).');
    process.exit(1);
  }
  log(`Framework: ${framework.name} (${framework._id})`, '📋');

  // 2. Optional fresh wipe of just the test data
  if (FRESH) {
    const catCodes = CATEGORIES.map((c) => c.code);
    const deleted = await RequirementCategory.deleteMany({
      frameworkId: framework._id,
      code: { $in: catCodes },
    });
    log(`Dropped ${deleted.deletedCount} test categories`, '🗑️ ');

    const cats = await RequirementCategory.find({ frameworkId: framework._id, code: { $in: catCodes } });
    if (cats.length === 0) {
      const identifiers = REQUIREMENTS.map((r) => r.identifier);
      const dr = await Requirement.deleteMany({
        frameworkId: framework._id,
        identifier: { $in: identifiers },
      });
      log(`Dropped ${dr.deletedCount} test requirements`, '🗑️ ');
    }
    console.log('');
  }

  // 3. Upsert categories
  log('Upserting RequirementCategories…', '📌');
  const categoryMap = new Map(); // code -> _id
  let catCreated = 0, catUpdated = 0;

  for (const cat of CATEGORIES) {
    const doc = await RequirementCategory.findOneAndUpdate(
      { frameworkId: framework._id, code: cat.code },
      { $set: { title: cat.title, order: cat.order, isActive: true } },
      { upsert: true, new: true, runValidators: true }
    );
    categoryMap.set(cat.code, doc._id);
    if (doc.createdAt.getTime() === doc.updatedAt.getTime()) catCreated++;
    else catUpdated++;
  }
  log(`Categories: ${catCreated} created, ${catUpdated} updated`, '✅');

  // 4. Upsert requirements
  log('Upserting Requirements…', '📌');
  let reqCreated = 0, reqUpdated = 0, reqSkipped = 0;

  for (const req of REQUIREMENTS) {
    const categoryId = categoryMap.get(req.categoryCode);
    if (!categoryId) {
      log(`Unknown categoryCode "${req.categoryCode}" for ${req.identifier} — skipped`, '⚠️ ');
      reqSkipped++;
      continue;
    }

    try {
      const doc = await Requirement.findOneAndUpdate(
        { frameworkId: framework._id, identifier: req.identifier },
        { $set: { categoryId, title: req.title, description: req.description, isActive: true } },
        { upsert: true, new: true, runValidators: true }
      );
      if (doc.createdAt.getTime() === doc.updatedAt.getTime()) reqCreated++;
      else reqUpdated++;
    } catch (err) {
      log(`Error on ${req.identifier}: ${err.message}`, '❌');
      reqSkipped++;
    }
  }
  log(`Requirements: ${reqCreated} created, ${reqUpdated} updated, ${reqSkipped} skipped`, '✅');

  // 5. Summary
  console.log('\n' + '='.repeat(55));
  console.log('  Done! Open /frameworks/SOC2 to test the UI.');
  console.log('='.repeat(55) + '\n');

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
