import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import '../src/models/index.js';
import Policy from '../src/models/Policy.js';
import PolicyVersion from '../src/models/PolicyVersion.js';
import User from '../src/models/User.js';
import policyService from '../src/services/policyService.js';
import { xssSanitize } from '../src/middleware/sanitize.js';

jest.setTimeout(60000);

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
  if (mongoose.connection.db) await mongoose.connection.db.dropDatabase();
});

function objectId() {
  return new mongoose.Types.ObjectId();
}

async function createActor(role = 'ADMIN') {
  const organizationId = objectId();
  const user = await User.create({
    organizationId,
    email: `${role.toLowerCase()}-${Date.now()}@example.com`,
    passwordHash: 'hash',
    firstName: role,
    lastName: 'User',
    role,
    status: 'ACTIVE',
  });
  return { organizationId, userId: user._id, user };
}

async function createPolicy({ organizationId, userId, currentVersionId = null }) {
  return Policy.create({
    organizationId,
    title: `Policy ${Date.now()}`,
    status: currentVersionId ? 'ACTIVE' : 'DRAFT',
    workflowStatus: currentVersionId ? 'APPROVED' : 'DRAFT',
    ownerId: userId,
    currentVersionId,
    reviewFrequency: 'ANNUALLY',
  });
}

describe('policy editor content sanitization', () => {
  test('global XSS middleware preserves raw contentHtml only for policy version writes', () => {
    const policyReq = {
      method: 'PATCH',
      path: '/api/v1/policies/64b000000000000000000000/versions/64b000000000000000000001',
      body: {
        contentHtml: '<h1>Security Policy</h1>',
        changelog: '<script>alert(1)</script>',
      },
    };
    xssSanitize(policyReq, {}, () => {});

    expect(policyReq.body.contentHtml).toBe('<h1>Security Policy</h1>');
    expect(policyReq.body.changelog).toContain('&lt;script&gt;');

    const otherReq = {
      method: 'PATCH',
      path: '/api/v1/policies/64b000000000000000000000',
      body: { contentHtml: '<h1>Escaped</h1>' },
    };
    xssSanitize(otherReq, {}, () => {});

    expect(otherReq.body.contentHtml).toBe('&lt;h1&gt;Escaped&lt;/h1&gt;');
  });

  test('contentHtml saves as real safe HTML and strips unsafe HTML', async () => {
    const actor = await createActor();
    const policy = await createPolicy(actor);

    const version = await policyService.createVersion(
      policy._id,
      {
        contentHtml:
          '<h1>Security Policy</h1><table style="width:100%"><tr><td>Cell</td></tr></table><script>alert(1)</script><p onclick="bad()">Body</p>',
      },
      null,
      actor
    );

    expect(version.contentHtml).toContain('<h1>Security Policy</h1>');
    expect(version.contentHtml).toContain('<table style="width:100%">');
    expect(version.contentHtml).toContain('<td>Cell</td>');
    expect(version.contentHtml).not.toContain('&lt;h1&gt;');
    expect(version.contentHtml).not.toContain('<script>');
    expect(version.contentHtml).not.toContain('onclick');
    expect(version.contentType).toBe('EDITOR_HTML');
    expect(version.contentHash).toHaveLength(64);
  });
});

describe('policy editor draft separation', () => {
  test('editor draft creation ignores uploaded-file draft versions', async () => {
    const actor = await createActor();
    const policy = await createPolicy(actor);
    await PolicyVersion.create({
      organizationId: actor.organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: 'DRAFT',
      contentType: 'UPLOADED_FILE',
      fileKey: 'policies/uploaded.pdf',
      fileName: 'uploaded.pdf',
      createdBy: actor.userId,
    });

    const draft = await policyService.getOrCreateEditorDraft(policy._id, actor);

    expect(draft.versionNumber).toBe(2);
    expect(draft.contentType).toBe('EDITOR_HTML');
    expect(draft.fileKey).toBeUndefined();
  });

  test('editor draft copies from current published editor HTML version', async () => {
    const actor = await createActor();
    const policy = await createPolicy(actor);
    const current = await PolicyVersion.create({
      organizationId: actor.organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: 'ACTIVE',
      contentType: 'EDITOR_HTML',
      contentHtml: '<h1>Approved Policy</h1>',
      createdBy: actor.userId,
    });
    policy.currentVersionId = current._id;
    policy.status = 'ACTIVE';
    policy.workflowStatus = 'APPROVED';
    await policy.save();

    const draft = await policyService.getOrCreateEditorDraft(policy._id, actor);

    expect(draft.versionNumber).toBe(2);
    expect(draft.contentHtml).toContain('<h1>Approved Policy</h1>');
    expect(String(draft.draftSourceVersionId)).toBe(String(current._id));
  });

  test('reset endpoint restores draft content from current editor source', async () => {
    const actor = await createActor();
    const policy = await createPolicy(actor);
    const current = await PolicyVersion.create({
      organizationId: actor.organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: 'ACTIVE',
      contentType: 'EDITOR_HTML',
      contentHtml: '<h1>Published</h1>',
      createdBy: actor.userId,
    });
    policy.currentVersionId = current._id;
    await policy.save();
    const draft = await PolicyVersion.create({
      organizationId: actor.organizationId,
      policyId: policy._id,
      versionNumber: 2,
      status: 'DRAFT',
      contentType: 'EDITOR_HTML',
      contentHtml: '<h1>Changed Draft</h1>',
      createdBy: actor.userId,
    });

    const reset = await policyService.resetEditorDraft(policy._id, actor);

    expect(String(reset._id)).toBe(String(draft._id));
    expect(reset.contentHtml).toContain('<h1>Published</h1>');
    expect(String(reset.draftSourceVersionId)).toBe(String(current._id));
  });

  test('uploaded-file versions cannot be edited with contentHtml', async () => {
    const actor = await createActor();
    const policy = await createPolicy(actor);
    const uploaded = await PolicyVersion.create({
      organizationId: actor.organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: 'DRAFT',
      contentType: 'UPLOADED_FILE',
      fileKey: 'policies/uploaded.pdf',
      createdBy: actor.userId,
    });

    await expect(
      policyService.updateVersion(policy._id, uploaded._id, { contentHtml: '<p>Edit</p>' }, actor)
    ).rejects.toThrow('Uploaded-file versions cannot be edited with the policy editor');
  });

});
