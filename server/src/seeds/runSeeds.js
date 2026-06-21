/**
 * Database Seeder - runSeeds.js
 * 
 * Seeds the database with Frameworks, Requirements, and GlobalControlTemplates.
 * 
 * Usage:
 *   npm run seed          - Seed data (upsert mode)
 *   npm run seed:fresh    - Drop existing data and reseed
 *   npm run seed:all      - Transform CSVs then seed
 * 
 * Execution Order:
 *   1. Frameworks (static data)
 *   2. Requirements (from manual JSON files)
 *   3. GlobalControlTemplates (with safety net for missing requirements)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const DATA_DIR = path.join(__dirname, 'data');
const REQUIREMENTS_DIR = path.join(DATA_DIR, 'requirements');
const CATEGORIES_FILE = path.join(DATA_DIR, 'requirementCategories.json');
const TEST_TEMPLATES_FILE = path.join(DATA_DIR, 'globalTestTemplates.json');
const POLICY_TEMPLATES_RAW = path.join(__dirname, 'raw', 'Vanta-Policy-Templates');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';

// Parse CLI arguments
const args = process.argv.slice(2);
const FRESH_MODE = args.includes('--fresh');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// =============================================================================
// IMPORT MODELS
// =============================================================================

// Import models dynamically to ensure they're registered
import '../models/index.js';

import Framework from '../models/Framework.js';
import RequirementCategory from '../models/RequirementCategory.js';
import Requirement from '../models/Requirement.js';
import GlobalControlTemplate from '../models/GlobalControlTemplate.js';
import GlobalTestTemplate from '../models/GlobalTestTemplate.js';
import PolicyTemplate from '../models/PolicyTemplate.js';
import RiskTemplate from '../models/RiskTemplate.js';
import { storageService } from '../services/storageService.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function log(message, type = 'info') {
  const icons = {
    info: 'ℹ️ ',
    success: '✅',
    warn: '⚠️ ',
    error: '❌',
    step: '📌',
  };
  console.log(`${icons[type] || ''} ${message}`);
}

function verboseLog(message) {
  if (VERBOSE) {
    console.log(`   ${message}`);
  }
}

function loadJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// =============================================================================
// SEEDER: FRAMEWORKS
// =============================================================================

async function seedFrameworks() {
  log('Seeding Frameworks...', 'step');

  const filePath = path.join(DATA_DIR, 'frameworks.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`frameworks.json not found at ${filePath}`);
  }

  const frameworks = loadJSON(filePath);
  let created = 0;
  let updated = 0;

  for (const fw of frameworks) {
    const result = await Framework.findOneAndUpdate(
      { code: fw.code },
      {
        $set: {
          name: fw.name,
          version: fw.version,
          description: fw.description,
          isActive: fw.isActive ?? true,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
      verboseLog(`Created: ${fw.code} - ${fw.name}`);
    } else {
      updated++;
      verboseLog(`Updated: ${fw.code}`);
    }
  }

  log(`Frameworks: ${created} created, ${updated} updated`, 'success');
  return frameworks.length;
}

// =============================================================================
// SEEDER: REQUIREMENT CATEGORIES
// =============================================================================

async function seedRequirementCategories() {
  log('Seeding RequirementCategories...', 'step');

  if (!fs.existsSync(CATEGORIES_FILE)) {
    throw new Error(`requirementCategories.json not found at ${CATEGORIES_FILE}`);
  }

  const categories = loadJSON(CATEGORIES_FILE);
  const frameworks = await Framework.find({});
  const frameworkMap = new Map(frameworks.map(fw => [fw.code, fw._id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cat of categories) {
    const frameworkId = frameworkMap.get(cat.frameworkCode);
    if (!frameworkId) {
      log(`Unknown frameworkCode "${cat.frameworkCode}" in requirementCategories.json, skipping...`, 'warn');
      skipped++;
      continue;
    }

    try {
      const result = await RequirementCategory.findOneAndUpdate(
        { frameworkId, code: cat.code },
        {
          $set: {
            title: cat.title,
            order: cat.order ?? 0,
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      log(`Error seeding category ${cat.frameworkCode}/${cat.code}: ${error.message}`, 'warn');
      skipped++;
    }
  }

  log(`RequirementCategories: ${created} created, ${updated} updated, ${skipped} skipped`, 'success');
  return created + updated;
}

// =============================================================================
// SEEDER: REQUIREMENTS
// =============================================================================

async function seedRequirements() {
  log('Seeding Requirements from manual JSON files...', 'step');

  // Build framework code -> ObjectId map
  const frameworks = await Framework.find({});
  const frameworkMap = new Map();
  for (const fw of frameworks) {
    frameworkMap.set(fw.code, fw._id);
  }
  const categories = await RequirementCategory.find({});
  const categoryMap = new Map();
  for (const cat of categories) {
    const fw = frameworks.find(f => f._id.equals(cat.frameworkId));
    if (fw) {
      categoryMap.set(`${fw.code}:${cat.code}`, cat._id);
    }
  }

  // Load all requirement files
  const files = fs.readdirSync(REQUIREMENTS_DIR).filter(f => f.endsWith('.json'));
  
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(REQUIREMENTS_DIR, file);
    const requirements = loadJSON(filePath);
    
    verboseLog(`Processing ${file} (${requirements.length} requirements)`);

    for (const req of requirements) {
      const frameworkId = frameworkMap.get(req.frameworkCode);
      
      if (!frameworkId) {
        log(`Unknown frameworkCode "${req.frameworkCode}" in ${file}, skipping...`, 'warn');
        totalSkipped++;
        continue;
      }
      const categoryId = categoryMap.get(`${req.frameworkCode}:${req.categoryCode}`);
      if (!categoryId) {
        log(`No category found for ${req.frameworkCode}/${req.categoryCode} (req: ${req.identifier}), skipping...`, 'warn');
        totalSkipped++;
        continue;
      }

      try {
        const result = await Requirement.findOneAndUpdate(
          { 
            frameworkId: frameworkId,
            identifier: req.identifier,
          },
          {
            $set: {
              categoryId: categoryId,
              title: req.title,
              description: req.description || '',
              isActive: true,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          totalCreated++;
        } else {
          totalUpdated++;
        }
      } catch (error) {
        log(`Error seeding requirement ${req.identifier}: ${error.message}`, 'warn');
        totalSkipped++;
      }
    }
  }

  log(`Requirements: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`, 'success');
  return totalCreated + totalUpdated;
}

// =============================================================================
// SEEDER: GLOBAL CONTROL TEMPLATES (with Safety Net)
// =============================================================================

async function seedGlobalControlTemplates() {
  log('Seeding GlobalControlTemplates...', 'step');

  const filePath = path.join(DATA_DIR, 'globalControlTemplates.json');
  if (!fs.existsSync(filePath)) {
    log(`globalControlTemplates.json not found. Run "npm run seed:transform" first.`, 'warn');
    return 0;
  }

  const templates = loadJSON(filePath);

  // Build framework code -> ObjectId map
  const frameworks = await Framework.find({});
  const frameworkMap = new Map();
  for (const fw of frameworks) {
    frameworkMap.set(fw.code, fw._id);
  }

  // Build requirement lookup map: "frameworkCode:identifier" -> ObjectId
  const requirements = await Requirement.find({});
  const requirementMap = new Map();
  for (const req of requirements) {
    const framework = frameworks.find(f => f._id.equals(req.frameworkId));
    if (framework) {
      const key = `${framework.code}:${req.identifier}`;
      requirementMap.set(key, req._id);
    }
  }

  let created = 0;
  let updated = 0;

  for (const template of templates) {
    // Resolve suggestedRequirements to ObjectIds
    const resolvedRequirements = [];

    for (const sr of template.suggestedRequirements) {
      const key = `${sr.frameworkCode}:${sr.identifier}`;
      let requirementId = requirementMap.get(key);

      if (!requirementId) {
        log(`Missing requirement mapping ${sr.frameworkCode}:${sr.identifier}, skipping mapping...`, 'warn');
        continue;
      }

      if (requirementId) {
        resolvedRequirements.push({
          requirementId: requirementId,
          frameworkId: frameworkMap.get(sr.frameworkCode),
          coverage: sr.coverage || 'FULL',
          justification: sr.justification || '',
        });
      }
    }

    // Upsert the template
    try {
      const result = await GlobalControlTemplate.findOneAndUpdate(
        { identifier: template.identifier },
        {
          $set: {
            title: template.title,
            description: template.description,
            controlGroup: template.controlGroup,
            suggestedPolicySlugs: template.suggestedPolicySlugs || [],
            frequency: template.frequency || 'QUARTERLY',
            implementationGuidance: template.implementationGuidance || '',
            suggestedRequirements: resolvedRequirements,
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        verboseLog(`Created template: ${template.identifier}`);
      } else {
        updated++;
        verboseLog(`Updated template: ${template.identifier}`);
      }
    } catch (error) {
      log(`Error seeding template ${template.identifier}: ${error.message}`, 'error');
    }
  }

  log(`GlobalControlTemplates: ${created} created, ${updated} updated`, 'success');
  
  return created + updated;
}

// =============================================================================
// SEEDER: GLOBAL TEST TEMPLATES
// =============================================================================

async function seedGlobalTestTemplates() {
  log('Seeding GlobalTestTemplates...', 'step');

  if (!fs.existsSync(TEST_TEMPLATES_FILE)) {
    log('globalTestTemplates.json not found, skipping...', 'warn');
    return 0;
  }

  const templates = loadJSON(TEST_TEMPLATES_FILE);
  let created = 0;
  let updated = 0;

  for (const t of templates) {
    try {
      const result = await GlobalTestTemplate.findOneAndUpdate(
        { name: t.name },
        {
          $set: {
            description: t.description || '',
            evidenceGuidance: t.evidenceGuidance || '',
            type: t.type,
            category: t.category || 'Engineering',
            renewalPeriod: t.renewalPeriod,
            suggestedControlIdentifiers: t.suggestedControlIdentifiers || [],
            isActive: t.isActive ?? true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      log(`Error seeding global test template "${t.name}": ${error.message}`, 'warn');
    }
  }

  log(`GlobalTestTemplates: ${created} created, ${updated} updated`, 'success');
  return created + updated;
}

// =============================================================================
// SEEDER: POLICY TEMPLATES (Global Library)
// =============================================================================

async function seedPolicyTemplates() {
  log('Seeding PolicyTemplates (policy library)...', 'step');

  const filePath = path.join(DATA_DIR, 'policyLibrary.json');
  if (!fs.existsSync(filePath)) {
    log('policyLibrary.json not found. Run "npm run seed:transform:policies" first.', 'warn');
    return 0;
  }

  const templates = loadJSON(filePath);
  let created = 0;
  let updated = 0;
  let uploaded = 0;

  const mimeByExt = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  };

  for (const t of templates) {
    try {
      let fileKey = null;
      const localPath = path.join(POLICY_TEMPLATES_RAW, t.filename);

      if (fs.existsSync(localPath)) {
        try {
          const buffer = fs.readFileSync(localPath);
          const uploadResult = await storageService.uploadPolicyTemplate(
            buffer,
            t.filename,
            mimeByExt(t.filename)
          );
          fileKey = uploadResult.key;
          uploaded++;
          verboseLog(`Uploaded: ${t.filename} → ${storageService.getStorageMode()}`);
        } catch (uploadErr) {
          log(`Upload failed for ${t.filename}: ${uploadErr.message}. Template saved without fileKey.`, 'warn');
        }
      } else {
        verboseLog(`File not found: ${t.filename}, skipping upload`);
      }

      const result = await PolicyTemplate.findOneAndUpdate(
        { slug: t.slug },
        {
          $set: {
            title: t.title,
            description: t.description || '',
            filename: t.filename,
            ...(fileKey && { fileKey }),
            frameworkCodes: t.frameworkCodes || [],
            category: t.category || 'General',
            source: t.source || 'VANTA',
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        verboseLog(`Created: ${t.slug}`);
      } else {
        updated++;
        verboseLog(`Updated: ${t.slug}`);
      }
    } catch (error) {
      log(`Error seeding policy template "${t.slug}": ${error.message}`, 'warn');
    }
  }

  log(`PolicyTemplates: ${created} created, ${updated} updated, ${uploaded} files uploaded to ${storageService.getStorageMode()}`, 'success');
  return created + updated;
}

// =============================================================================
// SEEDER: RISK TEMPLATES (Global Library)
// Threat scenarios only: title, description, categoryNames, isGlobal (no default assessments).
// Prefer data/risks.json (new format); fallback to data/riskTemplates.json (legacy).
// =============================================================================

async function seedRiskTemplates() {
  log('Seeding RiskTemplates (global library)...', 'step');

  const risksPath = path.join(DATA_DIR, 'risks.json');
  const legacyPath = path.join(DATA_DIR, 'riskTemplates.json');
  const filePath = fs.existsSync(risksPath) ? risksPath : legacyPath;
  if (!fs.existsSync(filePath)) {
    log('risks.json and riskTemplates.json not found, skipping...', 'warn');
    return 0;
  }

  const raw = loadJSON(filePath);
  const templates = raw.map((t) => ({
    title: t.title,
    description: t.description ?? '',
    categoryNames: Array.isArray(t.categoryNames)
      ? t.categoryNames
      : t.category
        ? [t.category]
        : [],
    isGlobal: t.isGlobal !== undefined ? t.isGlobal : true,
  }));

  let created = 0;
  let updated = 0;

  for (const t of templates) {
    try {
      const result = await RiskTemplate.findOneAndUpdate(
        { title: t.title, isGlobal: true },
        {
          $set: {
            description: t.description,
            categoryNames: t.categoryNames,
            isGlobal: true,
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      log(`Error seeding risk template "${t.title}": ${error.message}`, 'warn');
    }
  }

  log(`RiskTemplates: ${created} created, ${updated} updated`, 'success');
  return created + updated;
}

// =============================================================================
// FRESH MODE: DROP EXISTING DATA
// =============================================================================

async function dropCollections() {
  log('FRESH MODE: Dropping existing seed data...', 'warn');

  // Drop in reverse dependency order
  await GlobalTestTemplate.deleteMany({});
  log('  Dropped: globaltesttemplates', 'info');

  await GlobalControlTemplate.deleteMany({});
  log('  Dropped: globalcontroltemplates', 'info');

  await PolicyTemplate.deleteMany({});
  log('  Dropped: policytemplates', 'info');

  await Requirement.deleteMany({});
  log('  Dropped: requirements', 'info');

  await RequirementCategory.deleteMany({});
  log('  Dropped: requirementcategories', 'info');

  await Framework.deleteMany({});
  log('  Dropped: frameworks', 'info');

  console.log('');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🌱 Compliance Platform - Database Seeder');
  console.log('='.repeat(60) + '\n');

  if (FRESH_MODE) {
    console.log('🔴 FRESH MODE ENABLED - Existing data will be deleted!\n');
  }

  try {
    // Connect to MongoDB
    log(`Connecting to MongoDB...`, 'step');
    await mongoose.connect(MONGO_URI);
    log(`Connected to: ${MONGO_URI}`, 'success');
    console.log('');

    // Fresh mode: drop existing data
    if (FRESH_MODE) {
      await dropCollections();
    }

    // Seed in order
    const results = {
      frameworks: await seedFrameworks(),
      requirementCategories: await seedRequirementCategories(),
      requirements: await seedRequirements(),
      templates: await seedGlobalControlTemplates(),
      testTemplates: await seedGlobalTestTemplates(),
      policyTemplates: await seedPolicyTemplates(),
      riskTemplates: await seedRiskTemplates(),
    };

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Seeding Summary');
    console.log('='.repeat(60));
    console.log(`   Frameworks:              ${results.frameworks}`);
    console.log(`   RequirementCategories:   ${results.requirementCategories}`);
    console.log(`   Requirements:            ${results.requirements}`);
    console.log(`   GlobalControlTemplates:  ${results.templates}`);
    console.log(`   GlobalTestTemplates:     ${results.testTemplates}`);
    console.log(`   PolicyTemplates:         ${results.policyTemplates}`);
    console.log(`   RiskTemplates:           ${results.riskTemplates}`);
    console.log('='.repeat(60));
    console.log('✨ Database seeding completed successfully!\n');

  } catch (error) {
    log(`Seeding failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('Database connection closed.', 'info');
  }
}

// Run
main();
