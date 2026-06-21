/**
 * Demo Tenant Seeder
 * Creates a complete demo organization with realistic data from Vanta exports
 * 
 * Prerequisites:
 *   - Global data must be seeded first (npm run seed:fresh)
 *   - Transform scripts should have generated demo/*.json files
 * 
 * Usage:
 *   npm run seed:demo        # Creates demo tenant (if not exists)
 *   npm run seed:demo:fresh  # Drops existing demo tenant, recreates
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Framework from '../models/Framework.js';
import PolicyTemplate from '../models/PolicyTemplate.js';
import GlobalControlTemplate from '../models/GlobalControlTemplate.js';
import GlobalTestTemplate from '../models/GlobalTestTemplate.js';
import InternalControl from '../models/InternalControl.js';
import Test from '../models/Test.js';
import Evidence from '../models/Evidence.js';
import Risk from '../models/Risk.js';
import Vendor from '../models/Vendor.js';
import Policy from '../models/Policy.js';
import PolicyVersion from '../models/PolicyVersion.js';
import ActivityLog from '../models/ActivityLog.js';
import { seedTrainingModulesForOrganization } from './seedTrainingModules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEMO_CONFIG = {
  organization: {
    name: 'Proto Demo Company',
    domain: 'demo.proto.cx',
    industry: 'Healthcare Technology',
    subscriptionTier: 'STARTUP',
  },
  admin: {
    email: 'admin@demo.proto.cx',
    password: 'DemoPass123!',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ADMIN',
  },
  additionalUsers: [
    {
      email: 'manager@demo.proto.cx',
      password: 'DemoPass123!',
      firstName: 'Security',
      lastName: 'Manager',
      role: 'MANAGER',
    },
    {
      email: 'employee@demo.proto.cx',
      password: 'DemoPass123!',
      firstName: 'John',
      lastName: 'Employee',
      role: 'EMPLOYEE',
    },
    {
      email: 'auditor@demo.proto.cx',
      password: 'DemoPass123!',
      firstName: 'External',
      lastName: 'Auditor',
      role: 'AUDITOR',
    },
  ],
  frameworks: ['SOC2', 'ISO27001', 'HIPAA', 'GDPR'],
};

// =============================================================================
// HELPERS
// =============================================================================

function loadJsonFile(filename) {
  const filepath = path.join(__dirname, 'demo', filename);
  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️  File not found: ${filename} (will be skipped)`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function randomDateInPast(daysBack = 90) {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return past;
}

function randomDateInFuture(daysAhead = 90) {
  const now = new Date();
  const future = new Date(now.getTime() + Math.random() * daysAhead * 24 * 60 * 60 * 1000);
  return future;
}

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

/**
 * Step 1: Create Demo Organization
 */
async function createOrganization() {
  console.log('\n📦 Upserting Demo Organization...');

  const frameworks = await Framework.find({
    code: { $in: DEMO_CONFIG.frameworks },
  });
  const frameworkIds = frameworks.map((f) => f._id);

  // Use upsert so the _id is stable across --fresh runs. This keeps existing
  // JWT tokens (which embed organizationId) valid without requiring re-login.
  const org = await Organization.findOneAndUpdate(
    { domain: DEMO_CONFIG.organization.domain },
    {
      $set: {
        name: DEMO_CONFIG.organization.name,
        industry: DEMO_CONFIG.organization.industry,
        subscriptionTier: DEMO_CONFIG.organization.subscriptionTier,
        setupComplete: true,
        'settings.timezone': 'America/New_York',
        'settings.dateFormat': 'MM/DD/YYYY',
        'settings.notificationsEnabled': true,
        'settings.enabledFrameworks': frameworkIds,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`   ✅ Upserted: ${org.name} (ID: ${org._id})`);
  return org;
}

/**
 * Step 2: Upsert Demo Users
 * Upserts by email so _id stays stable across --fresh runs (preserving JWTs).
 * Note: User model uses virtual 'password' field that triggers validation + hashing.
 */
async function createUsers(organizationId) {
  console.log('\n👥 Upserting Demo Users...');

  const users = [];

  // Helper: find existing user by email or create new; always re-set org + status
  async function upsertUser(userData, isAdmin = false) {
    let user = await User.findOne({ email: userData.email });
    if (user) {
      user.organizationId = organizationId;
      user.firstName = userData.firstName;
      user.lastName = userData.lastName;
      user.role = userData.role;
      user.status = 'ACTIVE';
      user.isEmailVerified = true;
      if (isAdmin) user.lastLogin = new Date();
      await user.save();
      console.log(`   ✅ Upserted ${userData.role}: ${userData.email}`);
    } else {
      user = new User({
        organizationId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        status: 'ACTIVE',
        isEmailVerified: true,
        ...(isAdmin ? { lastLogin: new Date() } : {}),
      });
      user.password = userData.password;
      await user.save();
      console.log(`   ✅ Created ${userData.role}: ${userData.email}`);
    }
    return user;
  }

  const admin = await upsertUser(DEMO_CONFIG.admin, true);
  users.push(admin);

  for (const userData of DEMO_CONFIG.additionalUsers) {
    const user = await upsertUser(userData);
    users.push(user);
  }

  return users;
}

/**
 * Step 3: Clone Global Templates to Internal Controls
 * Note: Templates use suggestedRequirements[].frameworkId, not frameworkIds
 */
async function cloneControlsFromTemplates(organizationId) {
  console.log('\n🔄 Cloning Global Templates → Internal Controls...');

  const Requirement = (await import('../models/Requirement.js')).default;

  // Get enabled frameworks
  const frameworks = await Framework.find({ 
    code: { $in: DEMO_CONFIG.frameworks } 
  }).lean();
  const frameworkIdStrings = frameworks.map(f => f._id.toString());
  const frameworkByCode = new Map(frameworks.map(f => [f.code, f._id]));

  console.log(`   📋 Enabled frameworks: ${DEMO_CONFIG.frameworks.join(', ')}`);

  // Build requirement lookup: "frameworkCode:identifier" -> requirementId
  const requirements = await Requirement.find({
    frameworkId: { $in: frameworks.map(f => f._id) },
  }).lean();
  const requirementMap = new Map();
  for (const req of requirements) {
    const fw = frameworks.find((f) => f._id.toString() === req.frameworkId?.toString());
    if (fw) {
      requirementMap.set(`${fw.code}:${req.identifier}`, req._id);
    }
  }
  console.log(`   📋 Requirement map: ${requirementMap.size} entries`);

  // Get ALL active templates (use lean for plain objects)
  const templates = await GlobalControlTemplate.find({ isActive: true }).lean();

  console.log(`   📊 Total active templates: ${templates.length}`);

  const internalControls = [];
  const controlIdMap = {}; // Map vanta identifier → InternalControl _id

  for (const template of templates) {
    // Resolve suggestedRequirements - handle both frameworkId (from runSeeds) and frameworkCode (from raw JSON)
    const resolved = [];
    for (const sr of template.suggestedRequirements || []) {
      let frameworkId = sr.frameworkId;
      let requirementId = sr.requirementId;

      if (!frameworkId && sr.frameworkCode) {
        frameworkId = frameworkByCode.get(sr.frameworkCode) || frameworkByCode.get(sr.frameworkCode?.toUpperCase());
      }
      if (!requirementId && sr.identifier && frameworkId) {
        const fw = frameworks.find((f) => f._id.toString() === frameworkId?.toString());
        const code = fw?.code || sr.frameworkCode;
        requirementId = requirementMap.get(`${code}:${sr.identifier}`);
      }

      if (frameworkId && requirementId && frameworkIdStrings.includes(frameworkId.toString())) {
        resolved.push({
          requirementId,
          frameworkId,
          coverage: sr.coverage || 'FULL',
          justification: sr.justification,
        });
      }
    }

    // Skip templates that have no relevant framework mappings
    if (resolved.length === 0) {
      continue;
    }

    const linkedRequirements = resolved;

    // Determine random status for demo variety
    const rand = Math.random();
    let manualStatus = 'PASS';
    if (rand > 0.9) manualStatus = 'NOT_APPLICABLE';  // 10% N/A
    else if (rand > 0.7) manualStatus = 'FAIL';        // 20% fail
    // Rest are PASS (70%)

    const control = {
      organizationId,
      sourceTemplateId: template._id,
      identifier: template.identifier,
      title: template.title,
      description: template.description,
      controlGroup: template.controlGroup,
      linkedRequirements,
      manualStatus,
      frequency: template.frequency || 'QUARTERLY',
    };

    internalControls.push(control);
    
    // Store mapping for later (risks/vendors linking)
    controlIdMap[template.identifier] = null; // Will be filled after insert
  }

  console.log(`   📊 Controls to create: ${internalControls.length}`);

  if (internalControls.length === 0) {
    console.log('   ⚠️  No controls matched enabled frameworks');
    return { controls: [], controlIdMap };
  }

  // Bulk insert
  const inserted = await InternalControl.insertMany(internalControls);
  
  // Build the mapping
  inserted.forEach(ctrl => {
    controlIdMap[ctrl.identifier] = ctrl._id;
  });

  console.log(`   ✅ Cloned ${inserted.length} Internal Controls`);
  
  // Summary by status
  const statusCounts = inserted.reduce((acc, c) => {
    acc[c.manualStatus] = (acc[c.manualStatus] || 0) + 1;
    return acc;
  }, {});
  console.log('   📈 Status distribution:', statusCounts);

  // Verify linked requirements
  const withReqs = inserted.filter(c => c.linkedRequirements?.length > 0).length;
  const withoutReqs = inserted.length - withReqs;
  console.log(`   📋 With linked requirements: ${withReqs}, Without: ${withoutReqs}`);
  if (withoutReqs > 0) {
    console.log('   ⚠️  Some controls have no linked requirements — templates may need re-seeding');
  }

  return { controls: inserted, controlIdMap };
}

/**
 * Step 3.5: Provision tenant Tests and Evidence from GlobalTestTemplates.
 * - type: 'automated' → Test records (shown on /tests)
 * - type: 'document'  → Evidence records (shown on /documents)
 */
async function provisionTestsFromTemplates(organizationId, controls, adminUserId) {
  console.log('\n🧪 Provisioning Tests & Evidence from GlobalTestTemplates...');

  const templates = await GlobalTestTemplate.find({ isActive: true }).lean();
  if (templates.length === 0) {
    console.log('   ℹ️  No global test templates found');
    return { tests: [], evidence: [] };
  }

  const controlByIdentifier = new Map(controls.map(c => [c.identifier, c._id]));

  const existingTests = await Test.find({ organizationId }).select('name').lean();
  const existingTestNames = new Set(existingTests.map(t => t.name.toLowerCase().trim()));

  const existingEvidence = await Evidence.find({ organizationId }).select('title').lean();
  const existingEvidenceTitles = new Set(existingEvidence.map(e => e.title.toLowerCase().trim()));

  const testsToInsert = [];
  const evidenceToInsert = [];

  for (const template of templates) {
    const normalizedName = template.name.toLowerCase().trim();

    const linkedControlIds = (template.suggestedControlIdentifiers || [])
      .filter(identifier => controlByIdentifier.has(identifier))
      .map(identifier => controlByIdentifier.get(identifier));

    if (linkedControlIds.length === 0) continue;

    if (template.type === 'automated') {
      if (existingTestNames.has(normalizedName)) continue;
      testsToInsert.push({
        organizationId,
        notionId: `global-template:${normalizedName}`,
        name: template.name,
        description: template.description || '',
        evidenceGuidance: template.evidenceGuidance || '',
        type: 'automated',
        category: template.category || 'Engineering',
        renewalPeriod: template.renewalPeriod,
        rollout: 'enabled',
        linkedControlIds,
        isActive: true,
        status: 'ok',
      });
    } else if (template.type === 'document') {
      if (existingEvidenceTitles.has(normalizedName)) continue;
      evidenceToInsert.push({
        organizationId,
        title: template.name,
        description: template.evidenceGuidance || template.description || '',
        category: template.category || 'Engineering',
        linkedControlIds,
        uploadedBy: adminUserId,
        status: 'PENDING',
      });
    }
  }

  const insertedTests = testsToInsert.length > 0 ? await Test.insertMany(testsToInsert) : [];
  const insertedEvidence = evidenceToInsert.length > 0 ? await Evidence.insertMany(evidenceToInsert) : [];

  console.log(`   ✅ Created ${insertedTests.length} Tests (automated)`);
  console.log(`   ✅ Created ${insertedEvidence.length} Evidence records (documents)`);
  return { tests: insertedTests, evidence: insertedEvidence };
}

/**
 * Step 4: Seed Risks
 */
async function seedRisks(organizationId, controlIdMap, users) {
  console.log('\n⚠️  Seeding Risks...');

  const risksData = loadJsonFile('risks.json');
  if (!risksData) {
    console.log('   ⚠️  No risks.json found. Run: npm run seed:transform:risks');
    return [];
  }

  const adminUser = users.find(u => u.role === 'ADMIN');

  const risks = risksData.map(riskData => {
    // Resolve control identifiers to ObjectIds
    const mitigatingControlIds = (riskData.controlIdentifiers || [])
      .map(id => controlIdMap[id])
      .filter(Boolean); // Remove nulls for unmatched IDs

    return {
      organizationId,
      identifier: riskData.identifier,
      title: riskData.title,
      description: riskData.description || '',
      category: riskData.category || 'Uncategorized',
      
      // Scoring
      likelihood: riskData.likelihood || 3,
      impact: riskData.impact || 3,
      inherentScore: riskData.inherentScore || (riskData.likelihood * riskData.impact),
      residualScore: riskData.residualScore || riskData.inherentScore,
      
      // Treatment
      treatment: riskData.treatment || 'MITIGATE',
      treatmentPlan: riskData.treatmentPlan || '',
      status: riskData.status || 'OPEN',
      
      // Controls
      mitigatingControlIds,
      
      // Ownership
      ownerId: adminUser._id,
      
      // Dates
      identifiedAt: riskData.identifiedAt ? new Date(riskData.identifiedAt) : randomDateInPast(180),
      lastReviewedAt: randomDateInPast(30),
      lastReviewedBy: adminUser._id,
      nextReviewDue: randomDateInFuture(90),
    };
  });

  const inserted = await Risk.insertMany(risks);
  console.log(`   ✅ Seeded ${inserted.length} Risks`);

  // Summary
  const statusCounts = inserted.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('   📈 By Status:', statusCounts);

  const levelCounts = inserted.reduce((acc, r) => {
    acc[r.riskLevel] = (acc[r.riskLevel] || 0) + 1;
    return acc;
  }, {});
  console.log('   📈 By Risk Level:', levelCounts);

  return inserted;
}

/**
 * Step 5: Seed Vendors
 */
async function seedVendors(organizationId, controlIdMap, users) {
  console.log('\n🏢 Seeding Vendors...');

  const vendorsData = loadJsonFile('vendors.json');
  if (!vendorsData) {
    console.log('   ⚠️  No vendors.json found. Run: npm run seed:transform:vendors');
    return [];
  }

  const adminUser = users.find(u => u.role === 'ADMIN');

  const vendors = vendorsData.map(vendorData => {
    // Pick some random controls to link (for variety)
    const allControlIds = Object.values(controlIdMap).filter(Boolean);
    const numControls = Math.floor(Math.random() * 5); // 0-4 controls
    const linkedControlIds = [];
    for (let i = 0; i < numControls; i++) {
      const randomIdx = Math.floor(Math.random() * allControlIds.length);
      if (!linkedControlIds.includes(allControlIds[randomIdx])) {
        linkedControlIds.push(allControlIds[randomIdx]);
      }
    }

    return {
      organizationId,
      name: vendorData.name,
      description: vendorData.description || '',
      serviceType: vendorData.serviceType || 'General',
      category: vendorData.category || 'General Services',
      website: vendorData.website || null,
      
      riskTier: vendorData.riskTier || 'MEDIUM',
      status: vendorData.status || 'ACTIVE',
      
      linkedControlIds,
      
      primaryContact: vendorData.primaryContact || {},
      securityContact: {},
      
      hasNda: vendorData.hasNda || false,
      hasDpa: vendorData.hasDpa || false,
      hasSla: vendorData.hasSla || false,
      
      lastAssessmentDate: vendorData.lastAssessmentDate ? new Date(vendorData.lastAssessmentDate) : randomDateInPast(180),
      lastAssessedBy: adminUser._id,
      nextAssessmentDate: randomDateInFuture(180),
      assessmentFrequency: vendorData.assessmentFrequency || 'ANNUALLY',
      
      dataTypes: vendorData.dataTypes || [],
      
      notes: vendorData.notes || '',
      ownerId: adminUser._id,
    };
  });

  const inserted = await Vendor.insertMany(vendors);
  console.log(`   ✅ Seeded ${inserted.length} Vendors`);

  // Summary
  const tierCounts = inserted.reduce((acc, v) => {
    acc[v.riskTier] = (acc[v.riskTier] || 0) + 1;
    return acc;
  }, {});
  console.log('   📈 By Risk Tier:', tierCounts);

  return inserted;
}

/**
 * Step 6: Seed Policies
 */
async function seedPolicies(organizationId, users, policyTemplateMap) {
  console.log('\n📋 Seeding Policies...');

  const policiesData = loadJsonFile('policies.json');
  if (!policiesData) {
    console.log('   ⚠️  No policies.json found.');
    return [];
  }

  const adminUser = users.find(u => u.role === 'ADMIN');

  const policies = [];
  const versions = [];

  const frameworkCodeToId = policyTemplateMap?.frameworkCodeToId || new Map();
  const filenameToTemplateId = policyTemplateMap?.filenameToTemplateId || {};

  for (const policyData of policiesData) {
    const isActive = policyData.status === 'ACTIVE';
    const templateId = policyData.filename ? filenameToTemplateId[policyData.filename] : null;
    const frameworkIds = (policyData.frameworks || [])
      .map((code) => frameworkCodeToId.get(code))
      .filter(Boolean);

    // Create policy
    const policy = {
      _id: new mongoose.Types.ObjectId(),
      organizationId,
      title: policyData.title,
      description: policyData.description || '',
      category: policyData.category || 'General',
      status: isActive ? 'ACTIVE' : 'DRAFT',
      ownerId: adminUser._id,
      reviewFrequency: policyData.reviewFrequency || 'ANNUALLY',
      requiresAttestation: policyData.requiresAttestation || false,
      linkedControlIds: [],
      templateId: templateId || undefined,
      source: templateId ? 'VANTA' : 'CUSTOM',
      frameworkIds,
      lastReviewedAt: isActive ? randomDateInPast(60) : null,
      lastReviewedBy: isActive ? adminUser._id : null,
      nextReviewDue: isActive ? randomDateInFuture(300) : null,
    };

    // Create version
    const version = {
      _id: new mongoose.Types.ObjectId(),
      organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: isActive ? 'ACTIVE' : 'DRAFT',
      contentHtml: `<h1>${policyData.title}</h1><p>This is a demo policy document. The full content would be imported from: ${policyData.filename}</p>`,
      changelog: 'Initial version',
      effectiveDate: isActive ? randomDateInPast(90) : null,
      createdBy: adminUser._id,
      approvedBy: isActive ? adminUser._id : null,
      approvedAt: isActive ? randomDateInPast(90) : null,
    };

    // Link version to policy
    if (isActive) {
      policy.currentVersionId = version._id;
    }

    policies.push(policy);
    versions.push(version);
  }

  // Bulk insert
  await Policy.insertMany(policies);
  await PolicyVersion.insertMany(versions);

  console.log(`   ✅ Seeded ${policies.length} Policies`);
  console.log(`   ✅ Seeded ${versions.length} Policy Versions`);

  // Summary
  const statusCounts = policies.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  console.log('   📈 By Status:', statusCounts);

  return policies;
}

/**
 * Step 7: Create Activity Logs
 */
async function seedActivityLogs(organizationId, users, controls, risks, vendors, policies) {
  console.log('\n📝 Creating Activity Logs...');

  const activities = [];
  const adminUser = users.find(u => u.role === 'ADMIN');
  const managerUser = users.find(u => u.role === 'MANAGER');

  // Control assessments
  const passedControls = controls.filter(c => c.manualStatus === 'PASS').slice(0, 20);
  for (const control of passedControls) {
    activities.push({
      organizationId,
      actorId: adminUser._id,
      action: 'UPDATE',
      entityType: 'InternalControl',
      entityId: control._id,
      entitySnapshot: { title: control.title },
      after: { manualStatus: 'PASS' },
      createdAt: randomDateInPast(60),
    });
  }

  // Risk treatments
  const closedRisks = risks.filter(r => r.status === 'CLOSED').slice(0, 10);
  for (const risk of closedRisks) {
    activities.push({
      organizationId,
      actorId: adminUser._id,
      action: 'STATUS_CHANGE',
      entityType: 'Risk',
      entityId: risk._id,
      entitySnapshot: { title: risk.title },
      before: { status: 'OPEN' },
      after: { status: 'CLOSED' },
      createdAt: randomDateInPast(30),
    });
  }

  // Vendor assessments
  for (const vendor of vendors.slice(0, 5)) {
    activities.push({
      organizationId,
      actorId: managerUser?._id || adminUser._id,
      action: 'UPDATE',
      entityType: 'Vendor',
      entityId: vendor._id,
      entitySnapshot: { name: vendor.name },
      after: { lastAssessmentDate: vendor.lastAssessmentDate },
      createdAt: randomDateInPast(45),
    });
  }

  // Policy publications
  const activePolicies = policies.filter(p => p.status === 'ACTIVE').slice(0, 10);
  for (const policy of activePolicies) {
    activities.push({
      organizationId,
      actorId: adminUser._id,
      action: 'STATUS_CHANGE',
      entityType: 'Policy',
      entityId: policy._id,
      entitySnapshot: { title: policy.title },
      before: { status: 'DRAFT' },
      after: { status: 'ACTIVE' },
      createdAt: randomDateInPast(90),
    });
  }

  // Bulk insert
  if (activities.length > 0) {
    await ActivityLog.insertMany(activities);
    console.log(`   ✅ Created ${activities.length} Activity Logs`);
  }

  return activities;
}

/**
 * Step 8: Clean existing demo data
 * Note: ActivityLogs are skipped because compliance events are retained indefinitely.
 */
async function cleanDemoData() {
  console.log('\n🧹 Cleaning existing demo data...');

  const existingOrg = await Organization.findOne({ domain: DEMO_CONFIG.organization.domain });
  if (!existingOrg) {
    console.log('   ℹ️  No existing demo organization found');
    return;
  }

  const orgId = existingOrg._id;
  console.log(`   🔍 Found existing demo org: ${existingOrg.name} (${orgId})`);

  // Delete tenant-level data only. The org and user documents are preserved so
  // existing JWT tokens (which embed organizationId) stay valid across fresh runs.
  // Skip ActivityLog - compliance events must not be deleted by demo cleanup.
  const deletions = await Promise.all([
    PolicyVersion.deleteMany({ organizationId: orgId }),
    Policy.deleteMany({ organizationId: orgId }),
    Vendor.deleteMany({ organizationId: orgId }),
    Risk.deleteMany({ organizationId: orgId }),
    Test.deleteMany({ organizationId: orgId }),
    Evidence.deleteMany({ organizationId: orgId }),
    InternalControl.deleteMany({ organizationId: orgId }),
  ]);

  console.log('   ✅ Deleted:');
  console.log(`      - PolicyVersions: ${deletions[0].deletedCount}`);
  console.log(`      - Policies: ${deletions[1].deletedCount}`);
  console.log(`      - Vendors: ${deletions[2].deletedCount}`);
  console.log(`      - Risks: ${deletions[3].deletedCount}`);
  console.log(`      - Tests: ${deletions[4].deletedCount}`);
  console.log(`      - Evidence: ${deletions[5].deletedCount}`);
  console.log(`      - InternalControls: ${deletions[6].deletedCount}`);
  console.log('      - Users/Org: preserved (JWT tokens remain valid)');
  console.log('      - ActivityLogs: (skipped - retained indefinitely)');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function runDemoSeeds() {
  const isFresh = process.argv.includes('--fresh');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       🚀 DEMO TENANT SEEDING');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${isFresh ? '🔄 FRESH (dropping existing data)' : '➕ ADD (skip if exists)'}`);

  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ Connected!');

    // Check if global data exists
    const frameworkCount = await Framework.countDocuments();
    const templateCount = await GlobalControlTemplate.countDocuments();
    
    if (frameworkCount === 0 || templateCount === 0) {
      console.error('\n❌ ERROR: Global data not seeded!');
      console.error('   Please run: npm run seed:fresh');
      console.error('   Then run this script again.');
      process.exit(1);
    }
    console.log(`\n✅ Global data verified: ${frameworkCount} frameworks, ${templateCount} templates`);

    // Clean if fresh mode
    if (isFresh) {
      await cleanDemoData();
    } else {
      // Check if demo org already exists
      const existingOrg = await Organization.findOne({ domain: DEMO_CONFIG.organization.domain });
      if (existingOrg) {
        console.log('\n⚠️  Demo organization already exists!');
        console.log('   Use --fresh flag to recreate: npm run seed:demo:fresh');
        process.exit(0);
      }
    }

    // Execute seeding steps
    const organization = await createOrganization();
    const users = await createUsers(organization._id);
    const { controls, controlIdMap } = await cloneControlsFromTemplates(organization._id);
    const { tests } = await provisionTestsFromTemplates(organization._id, controls, users[0]._id);

    // Build policy template map (filename -> templateId) and framework code -> id
    const frameworks = await Framework.find({ code: { $in: DEMO_CONFIG.frameworks } });
    const frameworkCodeToId = new Map(frameworks.map((f) => [f.code, f._id]));
    const templates = await PolicyTemplate.find({});
    const filenameToTemplateId = {};
    for (const t of templates) {
      filenameToTemplateId[t.filename] = t._id;
    }
    const policyTemplateMap = { frameworkCodeToId, filenameToTemplateId };

    const risks = await seedRisks(organization._id, controlIdMap, users);
    const vendors = await seedVendors(organization._id, controlIdMap, users);
    const policies = await seedPolicies(organization._id, users, policyTemplateMap);
    const trainingModules = await seedTrainingModulesForOrganization(organization._id);
    await seedActivityLogs(organization._id, users, controls, risks, vendors, policies);

    // Final summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('       ✅ DEMO TENANT SEEDING COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log(`   Organization: ${organization.name}`);
    console.log(`   Domain: ${organization.domain}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Internal Controls: ${controls.length}`);
    console.log(`   Tests (automated): ${tests.length}`);
    console.log(`   Risks: ${risks.length}`);
    console.log(`   Vendors: ${vendors.length}`);
    console.log(`   Policies: ${policies.length}`);
    console.log(`   Training modules: ${trainingModules.total}`);
    
    console.log('\n🔐 Demo Credentials:');
    console.log('   ┌────────────────────────────────────────────────────────┐');
    console.log('   │ Role     │ Email                      │ Password       │');
    console.log('   ├────────────────────────────────────────────────────────┤');
    console.log(`   │ ADMIN    │ ${DEMO_CONFIG.admin.email.padEnd(26)} │ ${DEMO_CONFIG.admin.password.padEnd(14)} │`);
    for (const user of DEMO_CONFIG.additionalUsers) {
      console.log(`   │ ${user.role.padEnd(8)} │ ${user.email.padEnd(26)} │ ${user.password.padEnd(14)} │`);
    }
    console.log('   └────────────────────────────────────────────────────────┘');

    console.log('\n🎉 Your demo environment is ready!');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run
runDemoSeeds().catch((err) => {
  console.error(err);
  process.exit(1);
});
