import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Organization from '../models/Organization.js';
import User from '../models/User.js';
import InternalControl from '../models/InternalControl.js';
import Framework from '../models/Framework.js';
import Requirement from '../models/Requirement.js';
import Risk from '../models/Risk.js';
import Evidence from '../models/Evidence.js';
import ActivityLog from '../models/ActivityLog.js';
import { transformControlDrawerSeeds } from './transformers/transformControlDrawerData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_DOMAIN = 'demo.proto.cx';

function loadDrawerData() {
  const filePath = path.join(__dirname, 'demo', 'controlDrawerMappings.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('controlDrawerMappings.json not found. Run transformer first.');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function mapDocumentStatus(value) {
  const key = String(value || '').toUpperCase();
  if (['APPROVED', 'OK'].includes(key)) return 'APPROVED';
  if (key === 'EXPIRED') return 'EXPIRED';
  if (key === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function normalizeRequirementIdentifier(identifier) {
  const base = String(identifier || '').trim();
  return [base, base.replace(/\s+/g, ''), base.replace(/\s+/g, ' ').trim()]
    .filter(Boolean)
    .map((item) => item.toUpperCase());
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function buildControlResolver(controls, controlCatalog) {
  const byIdentifier = new Map();
  const byTitle = new Map();

  for (const control of controls) {
    byIdentifier.set(control.identifier, control._id);
    byTitle.set(normalizeText(control.title), control._id);
  }

  const resolvedByExternalId = new Map();
  for (const item of controlCatalog || []) {
    if (!item?.identifier) continue;
    const direct = byIdentifier.get(item.identifier);
    if (direct) {
      resolvedByExternalId.set(item.identifier, direct);
      continue;
    }

    const titleMatch = byTitle.get(normalizeText(item.title));
    if (titleMatch) {
      resolvedByExternalId.set(item.identifier, titleMatch);
    }
  }

  const unresolvedCount = (controlCatalog || []).filter((item) => !resolvedByExternalId.has(item.identifier)).length;

  return {
    unresolvedCount,
    resolveControlId(identifier) {
      return byIdentifier.get(identifier) || resolvedByExternalId.get(identifier) || null;
    },
  };
}

async function seedDocuments(orgId, adminUserId, resolveControlId, drawerData) {
  const documents = drawerData.documents || [];
  let upserted = 0;

  for (const doc of documents) {
    const linkedControlIds = Array.from(
      new Set((doc.controlIdentifiers || []).map((identifier) => resolveControlId(identifier)).filter(Boolean))
    );

    const selector = doc.externalId
      ? { organizationId: orgId, externalId: doc.externalId }
      : { organizationId: orgId, title: doc.title };

    const validUntil = doc.validUntil ? new Date(doc.validUntil) : undefined;
    let validFrom = new Date();
    if (validUntil) {
      const oneYearBefore = new Date(validUntil);
      oneYearBefore.setFullYear(oneYearBefore.getFullYear() - 1);
      validFrom = oneYearBefore;
      if (validUntil <= validFrom) {
        validFrom = new Date(validUntil.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    const payload = {
      title: doc.title,
      description: doc.description || '',
      category: doc.category || 'Other',
      status: mapDocumentStatus(doc.status),
      validFrom,
      validUntil,
      linkedControlIds,
      uploadedBy: adminUserId,
      source: 'VANTA_NETWORK_TAB',
      externalId: doc.externalId || undefined,
      tags: doc.tags || [],
    };

    const existing = await Evidence.findOne(selector);
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
    } else {
      await Evidence.create({
        organizationId: orgId,
        ...payload,
      });
    }

    upserted += 1;
  }

  return upserted;
}

async function applyFrameworkMappings(orgId, resolveControlId, drawerData) {
  const mappings = drawerData.frameworkMappings || [];
  if (!mappings.length) return 0;

  const org = await Organization.findById(orgId).lean();
  const frameworks = await Framework.find({ _id: { $in: org?.settings?.enabledFrameworks || [] } }).lean();

  const frameworkCodeToId = new Map(frameworks.map((fw) => [fw.code.toUpperCase(), fw._id]));

  const requirements = await Requirement.find({ frameworkId: { $in: frameworks.map((fw) => fw._id) } }).lean();
  const requirementLookup = new Map();

  for (const req of requirements) {
    const fw = frameworks.find((item) => item._id.toString() === req.frameworkId.toString());
    if (!fw) continue;
    for (const key of normalizeRequirementIdentifier(req.identifier)) {
      requirementLookup.set(`${fw.code.toUpperCase()}:${key}`, req._id);
    }
  }

  let mapped = 0;

  for (const mapping of mappings) {
    const controlId = resolveControlId(mapping.controlIdentifier);
    const frameworkCode = String(mapping.frameworkCode || '').toUpperCase();
    const frameworkId = frameworkCodeToId.get(frameworkCode);
    if (!controlId || !frameworkId) continue;

    const requirementKey = normalizeRequirementIdentifier(mapping.requirementIdentifier || '')
      .map((identifier) => `${frameworkCode}:${identifier}`)
      .find((key) => requirementLookup.has(key));

    if (!requirementKey) continue;
    const requirementId = requirementLookup.get(requirementKey);

    const result = await InternalControl.updateOne(
      { _id: controlId, organizationId: orgId },
      {
        $addToSet: {
          linkedRequirements: {
            frameworkId,
            requirementId,
            coverage: 'FULL',
            justification: 'Mapped from Vanta control drawer network data',
          },
        },
      }
    );

    if (result.modifiedCount > 0) mapped += 1;
  }

  return mapped;
}

async function applyRiskMappings(orgId, resolveControlId, drawerData) {
  const mappings = drawerData.riskMappings || [];
  if (!mappings.length) return 0;

  const risks = await Risk.find({ organizationId: orgId, isDeleted: { $ne: true } });
  let mapped = 0;

  for (const mapping of mappings) {
    const title = normalizeText(mapping.title);
    if (!title) continue;

    const risk = risks.find((item) => {
      const itemTitle = normalizeText(item.title);
      const itemDescription = normalizeText(item.description);
      return itemTitle === title || itemDescription === title;
    });

    if (!risk) continue;

    const controlIds = (mapping.controlIdentifiers || [])
      .map((identifier) => resolveControlId(identifier))
      .filter(Boolean)
      .map((id) => id.toString());

    if (!controlIds.length) continue;

    const existing = new Set((risk.mitigatingControlIds || []).map((id) => id.toString()));
    let changed = false;
    for (const id of controlIds) {
      if (!existing.has(id)) {
        existing.add(id);
        changed = true;
      }
    }

    if (changed) {
      risk.mitigatingControlIds = Array.from(existing);
      await risk.save();
      mapped += 1;
    }
  }

  return mapped;
}

async function runControlDrawerSeeds() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   📎 CONTROL DRAWER SEEDING (Documents + Mappings)');
  console.log('═══════════════════════════════════════════════════════════════');

  void ActivityLog;
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const org = await Organization.findOne({ domain: DEMO_DOMAIN });
    if (!org) {
      throw new Error('Demo organization not found. Run npm run seed:demo first.');
    }

    const adminUser = await User.findOne({ organizationId: org._id, role: 'ADMIN' }).lean();
    if (!adminUser) {
      throw new Error('Admin user not found in demo organization.');
    }

    const controls = await InternalControl.find({ organizationId: org._id, isDeleted: false })
      .select('_id identifier title')
      .lean();

    const transformed = transformControlDrawerSeeds();
    console.log(`   ✅ Transformed network data (${transformed.documents} docs, ${transformed.riskMappings} risk links, ${transformed.frameworkMappings} framework links)`);

    const drawerData = loadDrawerData();
    const { resolveControlId, unresolvedCount } = buildControlResolver(controls, drawerData.controlCatalog || []);
    if (unresolvedCount > 0) {
      console.log(`   ⚠️  Unresolved control ids from network data: ${unresolvedCount}`);
    }

    const documents = await seedDocuments(org._id, adminUser._id, resolveControlId, drawerData);
    const frameworkLinks = await applyFrameworkMappings(org._id, resolveControlId, drawerData);
    const riskLinks = await applyRiskMappings(org._id, resolveControlId, drawerData);

    console.log('\n✅ Control drawer seed completed');
    console.log(`   Documents upserted: ${documents}`);
    console.log(`   Framework links mapped: ${frameworkLinks}`);
    console.log(`   Risk links mapped: ${riskLinks}`);
  } finally {
    await mongoose.disconnect();
  }
}

runControlDrawerSeeds().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
});