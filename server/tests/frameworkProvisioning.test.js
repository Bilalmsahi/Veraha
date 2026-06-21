import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Framework from '../src/models/Framework.js';
import RequirementCategory from '../src/models/RequirementCategory.js';
import Requirement from '../src/models/Requirement.js';
import Organization from '../src/models/Organization.js';
import User from '../src/models/User.js';
import GlobalControlTemplate from '../src/models/GlobalControlTemplate.js';
import GlobalTestTemplate from '../src/models/GlobalTestTemplate.js';
import PolicyTemplate from '../src/models/PolicyTemplate.js';
import InternalControl from '../src/models/InternalControl.js';
import Test from '../src/models/Test.js';
import Evidence from '../src/models/Evidence.js';
import Policy from '../src/models/Policy.js';
import Risk from '../src/models/Risk.js';
import TrainingModule from '../src/models/TrainingModule.js';
import OrganizationFramework from '../src/models/OrganizationFramework.js';
import {
  provisionCompleteDatasetForOrganization,
  provisionFrameworkForOrganization,
} from '../src/services/frameworkProvisioningService.js';
import controlService from '../src/services/controlService.js';
import testService from '../src/services/testService.js';
import { assertFrameworkGrantedForOrg } from '../src/services/frameworkAccessService.js';
import readinessService from '../src/services/readinessService.js';

jest.setTimeout(30000);

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

afterEach(async () => {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

async function seedFramework(code, name) {
  const framework = await Framework.create({
    code,
    name,
    version: '2026',
    isActive: true,
  });
  const category = await RequirementCategory.create({
    frameworkId: framework._id,
    code: `${code}-CAT`,
    title: `${name} Category`,
  });
  const requirement = await Requirement.create({
    frameworkId: framework._id,
    categoryId: category._id,
    identifier: `${code}-REQ-1`,
    title: `${name} Requirement`,
  });
  return { framework, category, requirement };
}

async function seedOrg() {
  const organization = await Organization.create({
    name: 'Acme Compliance',
    slug: `acme-${Date.now()}`,
    setupComplete: false,
  });
  const user = await User.create({
    organizationId: organization._id,
    email: `admin-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Org',
    lastName: 'Admin',
    role: 'ADMIN',
    status: 'INVITED',
  });
  return { organization, user };
}

async function seedGlobalData() {
  const soc2 = await seedFramework('SOC2', 'SOC 2');
  const iso = await seedFramework('ISO27001', 'ISO 27001');

  await GlobalControlTemplate.create({
    identifier: 'CTL-SHARED-001',
    title: 'Shared access control',
    description: 'Shared by SOC2 and ISO',
    controlGroup: 'Access Control',
    suggestedPolicySlugs: ['access-policy'],
    suggestedRequirements: [
      { frameworkId: soc2.framework._id, requirementId: soc2.requirement._id, coverage: 'FULL' },
      { frameworkId: iso.framework._id, requirementId: iso.requirement._id, coverage: 'FULL' },
    ],
    isActive: true,
  });

  await GlobalTestTemplate.create([
    {
      name: 'Access review automation',
      description: 'Automated check',
      type: 'automated',
      category: 'Engineering',
      renewalPeriod: 'annually',
      suggestedControlIdentifiers: ['CTL-SHARED-001'],
      isActive: true,
    },
    {
      name: 'Access policy document',
      description: 'Document evidence',
      type: 'document',
      category: 'Policy',
      renewalPeriod: 'annually',
      suggestedControlIdentifiers: ['CTL-SHARED-001'],
      isActive: true,
    },
  ]);

  await PolicyTemplate.create({
    slug: 'access-policy',
    title: 'Access Policy',
    description: 'Access policy template',
    filename: 'access-policy.docx',
    frameworkCodes: ['SOC2', 'ISO27001'],
    category: 'Security',
    source: 'VANTA',
  });

  return { soc2, iso };
}

describe('framework provisioning', () => {
  test('granting a framework provisions controls, tests, evidence, policies, and training with fresh statuses', async () => {
    const { organization, user } = await seedOrg();
    await seedGlobalData();

    const result = await provisionFrameworkForOrganization({
      organizationId: organization._id,
      frameworkCodes: ['SOC2'],
      actorUserId: user._id,
    });

    expect(result.controlsCreated).toBe(1);
    expect(result.testsCreated).toBe(1);
    expect(result.evidenceCreated).toBe(1);
    expect(result.policiesCreated).toBe(1);

    const control = await InternalControl.findOne({ organizationId: organization._id });
    const test = await Test.findOne({ organizationId: organization._id });
    const evidence = await Evidence.findOne({ organizationId: organization._id });
    const policy = await Policy.findOne({ organizationId: organization._id });
    const trainingCount = await TrainingModule.countDocuments({ organizationId: organization._id });

    expect(control.linkedRequirements).toHaveLength(2);
    expect(test.status).toBe('needs_remediation');
    expect(test.skipStatusRecompute).toBe(true);
    expect(test.linkedControlIds.map(String)).toContain(String(control._id));
    expect(evidence.status).toBe('PENDING');
    expect(evidence.linkedControlIds.map(String)).toContain(String(control._id));
    expect(policy.status).toBe('DRAFT');
    expect(policy.linkedControlIds.map(String)).toContain(String(control._id));
    expect(trainingCount).toBeGreaterThan(0);
  });

  test('provisioning is idempotent and reuses shared controls without duplicating children', async () => {
    const { organization, user } = await seedOrg();
    await seedGlobalData();

    await provisionFrameworkForOrganization({
      organizationId: organization._id,
      frameworkCodes: ['SOC2'],
      actorUserId: user._id,
    });
    const second = await provisionFrameworkForOrganization({
      organizationId: organization._id,
      frameworkCodes: ['ISO27001'],
      actorUserId: user._id,
    });

    expect(second.controlsCreated).toBe(0);
    expect(second.testsCreated).toBe(0);
    expect(second.evidenceCreated).toBe(0);
    expect(second.policiesCreated).toBe(0);
    expect(await InternalControl.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Test.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Evidence.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Policy.countDocuments({ organizationId: organization._id })).toBe(1);
  });

  test('freshly provisioned pending items do not create false framework readiness', async () => {
    const { organization, user } = await seedOrg();
    await seedGlobalData();

    await provisionFrameworkForOrganization({
      organizationId: organization._id,
      frameworkCodes: ['SOC2'],
      actorUserId: user._id,
    });

    const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
      organization._id,
      'SOC2'
    );

    expect(readiness.readinessScore).toBe(0);
    expect(readiness.rollup.requirement.pass).toBe(0);
  });

  test('complete org seed is separate from access grants and exposes shared plus unlinked data only after grant', async () => {
    const { organization, user } = await seedOrg();
    const { soc2, iso } = await seedGlobalData();

    await GlobalControlTemplate.create({
      identifier: 'CTL-GLOBAL-001',
      title: 'Global compliance resource',
      description: 'Not tied to a specific framework',
      controlGroup: 'Governance',
      suggestedRequirements: [],
      suggestedPolicySlugs: [],
      isActive: true,
    });

    await GlobalTestTemplate.create({
      name: 'Global compliance checklist',
      description: 'Unlinked global test',
      type: 'automated',
      category: 'Engineering',
      renewalPeriod: 'annually',
      suggestedControlIdentifiers: ['CTL-GLOBAL-001'],
      isActive: true,
    });

    const seedResult = await provisionCompleteDatasetForOrganization({
      organizationId: organization._id,
      actorUserId: user._id,
    });
    const secondSeed = await provisionCompleteDatasetForOrganization({
      organizationId: organization._id,
      actorUserId: user._id,
    });

    expect(seedResult.skipped).toBe(false);
    expect(secondSeed.skipped).toBe(true);
    expect(await InternalControl.countDocuments({ organizationId: organization._id })).toBe(2);
    expect(await Test.countDocuments({ organizationId: organization._id })).toBe(2);

    const lockedControls = await controlService.getControls(organization._id, { limit: 50 });
    expect(lockedControls.controls).toHaveLength(0);

    await OrganizationFramework.create({
      organizationId: organization._id,
      frameworkId: soc2.framework._id,
      purchasedBy: 'super_admin',
      revokedAt: null,
    });

    const soc2Controls = await controlService.getControls(organization._id, { limit: 50 });
    expect(soc2Controls.controls.map((control) => control.identifier).sort()).toEqual([
      'CTL-GLOBAL-001',
      'CTL-SHARED-001',
    ]);

    const tests = await testService.listTests(organization._id, { limit: 50 });
    expect(tests.tests.map((test) => test.name).sort()).toEqual([
      'Access review automation',
      'Global compliance checklist',
    ]);

    await expect(assertFrameworkGrantedForOrg(organization._id, iso.framework._id)).rejects.toMatchObject({
      statusCode: 403,
    });

    await OrganizationFramework.updateOne(
      { organizationId: organization._id, frameworkId: soc2.framework._id },
      { $set: { revokedAt: new Date() } }
    );

    const revokedControls = await controlService.getControls(organization._id, { limit: 50 });
    expect(revokedControls.controls).toHaveLength(0);
    expect(await InternalControl.countDocuments({ organizationId: organization._id })).toBe(2);
  });

  test('complete dataset seeds once per organization and tenant records never cross organization boundaries', async () => {
    const { organization: orgA, user: userA } = await seedOrg();
    const { organization: orgB, user: userB } = await seedOrg();
    await seedGlobalData();

    await provisionCompleteDatasetForOrganization({
      organizationId: orgA._id,
      actorUserId: userA._id,
    });
    await provisionCompleteDatasetForOrganization({
      organizationId: orgA._id,
      actorUserId: userA._id,
    });
    await provisionCompleteDatasetForOrganization({
      organizationId: orgB._id,
      actorUserId: userB._id,
    });

    for (const Model of [InternalControl, Test, Evidence, Policy, TrainingModule]) {
      const orgARecords = await Model.find({ organizationId: orgA._id }).select('_id organizationId').lean();
      const orgBRecords = await Model.find({ organizationId: orgB._id }).select('_id organizationId').lean();
      expect(orgARecords.length).toBeGreaterThan(0);
      expect(orgBRecords.length).toBeGreaterThan(0);
      const orgBIds = new Set(orgBRecords.map((record) => String(record._id)));
      expect(orgARecords.some((record) => orgBIds.has(String(record._id)))).toBe(false);
      expect(orgARecords.every((record) => String(record.organizationId) === String(orgA._id))).toBe(true);
      expect(orgBRecords.every((record) => String(record.organizationId) === String(orgB._id))).toBe(true);
    }

    expect(await InternalControl.countDocuments({ organizationId: orgA._id })).toBe(1);
    expect(await Test.countDocuments({ organizationId: orgA._id })).toBe(1);
    expect(await Evidence.countDocuments({ organizationId: orgA._id })).toBe(1);
    expect(await Policy.countDocuments({ organizationId: orgA._id })).toBe(1);
  });

  test('readiness recalculates for locked and unlocked frameworks and shared controls count for every linked framework', async () => {
    const { organization, user } = await seedOrg();
    await seedGlobalData();

    await provisionCompleteDatasetForOrganization({
      organizationId: organization._id,
      actorUserId: user._id,
    });

    const control = await InternalControl.findOne({ organizationId: organization._id });
    await Promise.all([
      InternalControl.updateOne(
        { _id: control._id },
        { $set: { manualStatus: 'PASS', automationStatus: 'NOT_CONFIGURED', overallStatus: 'PASS' } }
      ),
      Test.updateOne({ organizationId: organization._id }, { $set: { status: 'ok' } }),
      Evidence.updateOne({ organizationId: organization._id }, { $set: { status: 'APPROVED' } }),
      Policy.updateOne(
        { organizationId: organization._id },
        { $set: { status: 'ACTIVE', workflowStatus: 'PUBLISHED', acknowledgementRate: 100 } }
      ),
      Risk.create({
        organizationId: organization._id,
        title: 'Accepted residual risk',
        category: 'Security',
        status: 'CLOSED',
        likelihood: 1,
        impact: 1,
        mitigatingControlIds: [control._id],
        ownerId: user._id,
      }),
    ]);

    const soc2 = await readinessService.getFrameworkReadinessWithWorkflowOverlay(organization._id, 'SOC2');
    const isoLocked = await readinessService.getFrameworkReadinessWithWorkflowOverlay(organization._id, 'ISO27001');
    expect(soc2.readinessScore).toBe(100);
    expect(isoLocked.readinessScore).toBe(100);

    await Evidence.updateOne({ organizationId: organization._id }, { $set: { status: 'PENDING' } });

    const updatedSoc2 = await readinessService.getFrameworkReadinessWithWorkflowOverlay(organization._id, 'SOC2');
    const updatedIsoLocked = await readinessService.getFrameworkReadinessWithWorkflowOverlay(organization._id, 'ISO27001');
    expect(updatedSoc2.readinessScore).toBe(0);
    expect(updatedIsoLocked.readinessScore).toBe(0);
  });

  test('concurrent complete-dataset requests leave one consistent tenant dataset', async () => {
    const { organization, user } = await seedOrg();
    await seedGlobalData();

    await Promise.all([
      provisionCompleteDatasetForOrganization({ organizationId: organization._id, actorUserId: user._id }),
      provisionCompleteDatasetForOrganization({ organizationId: organization._id, actorUserId: user._id }),
    ]);

    expect(await InternalControl.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Test.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Evidence.countDocuments({ organizationId: organization._id })).toBe(1);
    expect(await Policy.countDocuments({ organizationId: organization._id })).toBe(1);
  });
});
