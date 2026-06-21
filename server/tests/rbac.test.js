import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { getJwtSecret } from '../src/config/auth.js';
import {
  authorize,
  authorizeOrg,
  blockAuditor,
  injectOrgFilter,
  optionalAuth,
  requireAuth,
  requireMinRole,
  requireInternalUser,
} from '../src/middleware/authMiddleware.js';
import requireAuditorScope from '../src/middleware/requireAuditorScope.js';
import { requireOrg } from '../src/middleware/requireOrg.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import auditorRoutes from '../src/routes/auditorRoutes.js';
import userRoutes from '../src/routes/userRoutes.js';
import {
  ActivityLog,
  Audit,
  AuditAssignment,
  AuditEvidenceItem,
  AuditorProfile,
  Organization,
  User,
} from '../src/models/index.js';

let mongo;
let app;
let sequence = 0;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  sequence = 0;

  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }

  app = buildTestApp();
});

function buildTestApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use((req, res, next) => {
    Object.defineProperty(req, 'query', {
      value: { ...req.query },
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  });

  testApp.get('/test/auth', requireAuth, (req, res) => {
    res.status(200).json({
      userId: req.user._id.toString(),
      email: req.user.email,
      role: req.user.role,
    });
  });

  testApp.get('/test/optional', optionalAuth, (req, res) => {
    res.status(200).json({
      authenticated: Boolean(req.user),
      userId: req.user?._id.toString() || null,
    });
  });

  testApp.get('/test/internal', requireAuth, requireInternalUser, (req, res) => {
    res.status(200).json({ ok: true, orgId: req.orgId.toString() });
  });

  testApp.get('/test/internal-no-user', requireInternalUser, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/require-org', requireOrg, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/require-org-no-context', (req, res, next) => {
    req.user = { role: 'EMPLOYEE' };
    next();
  }, requireOrg, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/authorize-manager', requireAuth, authorize('MANAGER'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/authorize-no-user', authorize('ADMIN'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.post('/test/block-auditor', requireAuth, blockAuditor, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.post('/test/block-auditor-no-user', blockAuditor, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.patch('/test/min-manager', requireAuth, requireMinRole('MANAGER'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.patch('/test/min-manager-unknown-role', (req, res, next) => {
    req.user = { role: 'GUEST' };
    next();
  }, requireMinRole('MANAGER'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.patch('/test/min-manager-no-user', requireMinRole('MANAGER'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/authorize-org/:organizationId', requireAuth, authorizeOrg, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/authorize-org', requireAuth, (req, res, next) => {
    req.body = {};
    next();
  }, authorizeOrg, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/authorize-org-no-user', authorizeOrg, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/inject-org-filter', requireAuth, injectOrgFilter, (req, res) => {
    res.status(200).json({ organizationId: req.orgFilter.organizationId.toString() });
  });

  testApp.get('/test/inject-org-filter-no-user', injectOrgFilter, (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/audits/:auditId', requireAuth, requireAuditorScope('auditId'), (req, res) => {
    res.status(200).json({
      ok: true,
      auditId: req.audit._id.toString(),
      assignmentId: req.auditAssignment._id.toString(),
    });
  });

  testApp.get('/test/auditor-scope-no-user', requireAuditorScope('auditId'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.get('/test/auditor-scope-missing-id', requireAuth, (req, res, next) => {
    req.body = {};
    next();
  }, requireAuditorScope('auditId'), (req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.use('/api/v1/auditor', auditorRoutes);
  testApp.use('/api/v1/users', userRoutes);
  testApp.use(errorHandler);

  return testApp;
}

function unique(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function signToken(user, overrides = {}) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      ...overrides,
    },
    getJwtSecret()
  );
}

function expiredToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      iat: now - 7200,
      exp: now - 3600,
    },
    getJwtSecret()
  );
}

function tamperSignature(token) {
  const parts = token.split('.');
  const signature = parts[2];
  const flipped = signature[0] === 'a' ? 'b' : 'a';
  parts[2] = `${flipped}${signature.slice(1)}`;
  return parts.join('.');
}

async function createOrg(name = unique('Org')) {
  return Organization.create({
    name,
    domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example.com`,
  });
}

async function createUser({ organizationId, role = 'EMPLOYEE', email, firstName = 'Test', lastName = 'User' } = {}) {
  const orgId = organizationId || (await createOrg())._id;
  return User.create({
    organizationId: orgId,
    email: email || `${unique(role.toLowerCase())}@example.com`,
    password: 'ValidPassword123!',
    firstName,
    lastName,
    role,
    status: 'ACTIVE',
    lastActivityAt: new Date(),
  });
}

async function createAudit({ organizationId, name = unique('Audit'), status = 'SCHEDULED' } = {}) {
  const orgId = organizationId || (await createOrg())._id;
  return Audit.create({
    organizationId: orgId,
    name,
    status,
    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

async function createAuditorAssignment({
  organizationId,
  auditId,
  auditor,
  assignedBy,
  accessStartsAt = new Date(Date.now() - 60 * 60 * 1000),
  accessEndsAt = new Date(Date.now() + 60 * 60 * 1000),
  status = 'ACTIVE',
} = {}) {
  const auditorProfile = await AuditorProfile.findOrCreate(auditor.email, {
    firstName: auditor.firstName,
    lastName: auditor.lastName,
  });

  const admin = assignedBy || (await createUser({ organizationId, role: 'ADMIN' }));

  const assignment = await AuditAssignment.create({
    organizationId,
    auditId,
    auditorUserId: auditor._id,
    auditorProfile: auditorProfile._id,
    auditorEmail: auditor.email,
    assignedBy: admin._id,
    status,
    accessStartsAt,
    accessEndsAt,
  });

  return { assignment, auditorProfile };
}

async function createEvidenceItems({ organizationId, auditId, prefix }) {
  return AuditEvidenceItem.create([
    {
      organizationId,
      auditId,
      controlId: new mongoose.Types.ObjectId(),
      title: `${prefix} evidence 1`,
      status: 'READY_FOR_AUDIT',
    },
    {
      organizationId,
      auditId,
      controlId: new mongoose.Types.ObjectId(),
      title: `${prefix} evidence 2`,
      status: 'NOT_STARTED',
    },
  ]);
}

describe('requireAuth middleware', () => {
  test('returns 401 with no token', async () => {
    const response = await request(app).get('/test/auth');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns 401 with an expired token', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${expiredToken(user)}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/expired/i);
  });

  test('returns 401 with a tampered token', async () => {
    const user = await createUser();
    const token = tamperSignature(signToken(user));

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/invalid token/i);
  });

  test('returns 401 when the token references a disabled or missing user', async () => {
    const missingUserId = new mongoose.Types.ObjectId();
    const token = jwt.sign({ id: missingUserId.toString() }, getJwtSecret());

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/no longer exists|disabled/i);
  });

  test('returns 500 when the server JWT secret is unavailable', async () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousNodeEnv = process.env.NODE_ENV;
    const user = await createUser();
    const token = signToken(user);

    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${token}`);

    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/server authentication/i);
  });

  test('returns 200 with a valid token and attaches req.user', async () => {
    const user = await createUser({ role: 'MANAGER' });

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId: user._id.toString(),
      email: user.email,
      role: 'MANAGER',
    });
  });

  test('refreshes stale user activity without blocking authentication', async () => {
    const staleUser = await createUser({
      role: 'EMPLOYEE',
      email: 'stale-activity@example.com',
    });
    staleUser.lastActivityAt = new Date(Date.now() - 10 * 60 * 1000);
    await staleUser.save();
    const updateSpy = jest.spyOn(User, 'updateOne').mockReturnValueOnce(Promise.resolve({ modifiedCount: 1 }));

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(staleUser)}`);

    expect(response.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      { _id: staleUser._id },
      { $set: { lastActivityAt: expect.any(Date) } }
    );

    updateSpy.mockRestore();
  });

  test('returns 401 for unexpected authentication lookup errors', async () => {
    const user = await createUser();
    const findSpy = jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/not authorized/i);

    findSpy.mockRestore();
  });
});

describe('optionalAuth middleware', () => {
  test('allows requests without a token', async () => {
    const response = await request(app).get('/test/optional');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, userId: null });
  });

  test('attaches req.user when a valid token is present', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/test/optional')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: true, userId: user._id.toString() });
  });

  test('returns 401 when an invalid token is present', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/test/optional')
      .set('Authorization', `Bearer ${tamperSignature(signToken(user))}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/invalid token/i);
  });

  test('returns 401 when an expired token is present', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/test/optional')
      .set('Authorization', `Bearer ${expiredToken(user)}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/expired/i);
  });

  test('returns 500 when optional auth cannot access a server JWT secret', async () => {
    const previousSecret = process.env.JWT_SECRET;
    const previousNodeEnv = process.env.NODE_ENV;
    const user = await createUser();
    const token = signToken(user);

    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/optional')
      .set('Authorization', `Bearer ${token}`);

    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/server authentication/i);
  });

  test('returns 401 for unexpected optional-auth lookup errors', async () => {
    const user = await createUser();
    const findSpy = jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });

    const response = await request(app)
      .get('/test/optional')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/not authorized/i);

    findSpy.mockRestore();
  });
});

describe('requireInternalUser middleware', () => {
  test('returns 401 without req.user', async () => {
    const response = await request(app).get('/test/internal-no-user');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/authentication required/i);
  });

  test("blocks a user with role 'AUDITOR'", async () => {
    const user = await createUser({ role: 'AUDITOR' });

    const response = await request(app)
      .get('/test/internal')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/auditor/i);
  });

  test.each(['ADMIN', 'MANAGER', 'EMPLOYEE'])('allows users with role %s', async (role) => {
    const user = await createUser({ role });

    const response = await request(app)
      .get('/test/internal')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      orgId: user.organizationId.toString(),
    });
  });
});

describe('shared authorization middleware', () => {
  test('authorize requires an authenticated user', async () => {
    const response = await request(app).get('/test/authorize-no-user');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/authentication required/i);
  });

  test('authorize allows ADMIN even when the role is not explicitly listed', async () => {
    const admin = await createUser({ role: 'ADMIN' });

    const response = await request(app)
      .get('/test/authorize-manager')
      .set('Authorization', `Bearer ${signToken(admin)}`);

    expect(response.status).toBe(200);
  });

  test('authorize allows explicitly listed roles and rejects other roles', async () => {
    const manager = await createUser({ role: 'MANAGER' });
    const employee = await createUser({ role: 'EMPLOYEE' });

    const allowed = await request(app)
      .get('/test/authorize-manager')
      .set('Authorization', `Bearer ${signToken(manager)}`);

    const blocked = await request(app)
      .get('/test/authorize-manager')
      .set('Authorization', `Bearer ${signToken(employee)}`);

    expect(allowed.status).toBe(200);
    expect(blocked.status).toBe(403);
    expect(blocked.body.meta).toMatchObject({
      allowed: ['MANAGER'],
      current: 'EMPLOYEE',
    });
  });

  test('blockAuditor requires a user, blocks auditors, and allows internal users', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const auditor = await createUser({ role: 'AUDITOR' });

    const noUser = await request(app).post('/test/block-auditor-no-user');
    const blocked = await request(app)
      .post('/test/block-auditor')
      .set('Authorization', `Bearer ${signToken(auditor)}`);
    const allowed = await request(app)
      .post('/test/block-auditor')
      .set('Authorization', `Bearer ${signToken(admin)}`);

    expect(noUser.status).toBe(401);
    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  test('requireMinRole handles no-user, auditor, unknown, insufficient, and sufficient roles', async () => {
    const employee = await createUser({ role: 'EMPLOYEE' });
    const manager = await createUser({ role: 'MANAGER' });
    const auditor = await createUser({ role: 'AUDITOR' });

    const noUser = await request(app).patch('/test/min-manager-no-user');
    const unknown = await request(app).patch('/test/min-manager-unknown-role');
    const insufficient = await request(app)
      .patch('/test/min-manager')
      .set('Authorization', `Bearer ${signToken(employee)}`);
    const auditorBlocked = await request(app)
      .patch('/test/min-manager')
      .set('Authorization', `Bearer ${signToken(auditor)}`);
    const allowed = await request(app)
      .patch('/test/min-manager')
      .set('Authorization', `Bearer ${signToken(manager)}`);

    expect(noUser.status).toBe(401);
    expect(unknown.status).toBe(403);
    expect(unknown.body.error).toMatch(/unknown role/i);
    expect(insufficient.status).toBe(403);
    expect(auditorBlocked.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  test('authorizeOrg enforces organization params when present', async () => {
    const orgA = await createOrg('Authorize Org A');
    const orgB = await createOrg('Authorize Org B');
    const user = await createUser({ organizationId: orgA._id, role: 'EMPLOYEE' });

    const noUser = await request(app).get('/test/authorize-org-no-user');
    const sameOrg = await request(app)
      .get(`/test/authorize-org/${orgA._id}`)
      .set('Authorization', `Bearer ${signToken(user)}`);
    const otherOrg = await request(app)
      .get(`/test/authorize-org/${orgB._id}`)
      .set('Authorization', `Bearer ${signToken(user)}`);
    const noOrgParam = await request(app)
      .get('/test/authorize-org')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(noUser.status).toBe(401);
    expect(sameOrg.status).toBe(200);
    expect(otherOrg.status).toBe(403);
    expect(noOrgParam.status).toBe(200);
  });

  test('injectOrgFilter requires a user and attaches the organization filter', async () => {
    const user = await createUser({ role: 'EMPLOYEE' });

    const noUser = await request(app).get('/test/inject-org-filter-no-user');
    const allowed = await request(app)
      .get('/test/inject-org-filter')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(noUser.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(allowed.body.organizationId).toBe(user.organizationId.toString());
  });

  test('requireOrg returns 401 when called without req.user', async () => {
    const response = await request(app).get('/test/require-org');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/authentication required/i);
  });

  test('requireOrg returns 403 when req.user has no organization context', async () => {
    const response = await request(app).get('/test/require-org-no-context');

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/organization context/i);
  });
});

describe('requireAuditorScope middleware', () => {
  test('returns 401 without req.user', async () => {
    const response = await request(app).get('/test/auditor-scope-no-user');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/authentication required/i);
  });

  test('returns 400 when no audit id is supplied', async () => {
    const auditor = await createUser({ role: 'AUDITOR' });

    const response = await request(app)
      .get('/test/auditor-scope-missing-id')
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/audit id is required/i);
  });

  test("blocks a user with role 'EMPLOYEE'", async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const employee = await createUser({ organizationId: org._id, role: 'EMPLOYEE' });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(employee)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/auditor access required/i);
  });

  test('blocks an AUDITOR user with no active AuditAssignment', async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const auditor = await createUser({ organizationId: org._id, role: 'AUDITOR' });
    await AuditorProfile.findOrCreate(auditor.email, { firstName: auditor.firstName });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not assigned/i);
  });

  test('blocks an AUDITOR user with no AuditorProfile', async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const auditor = await createUser({ organizationId: org._id, role: 'AUDITOR' });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/profile not found/i);
  });

  test('blocks an AUDITOR user whose assignment access window has not started', async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const auditor = await createUser({ organizationId: org._id, role: 'AUDITOR' });
    await createAuditorAssignment({
      organizationId: org._id,
      auditId: audit._id,
      auditor,
      accessStartsAt: new Date(Date.now() + 60 * 60 * 1000),
      accessEndsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not started/i);
  });

  test('blocks an AUDITOR user whose assignment access window has expired', async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const auditor = await createUser({ organizationId: org._id, role: 'AUDITOR' });
    await createAuditorAssignment({
      organizationId: org._id,
      auditId: audit._id,
      auditor,
      accessStartsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      accessEndsAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/expired/i);
  });

  test('passes unexpected lookup errors to the error handler', async () => {
    const auditor = await createUser({ role: 'AUDITOR' });
    await AuditorProfile.findOrCreate(auditor.email, { firstName: auditor.firstName });

    const response = await request(app)
      .get('/test/audits/not-a-valid-object-id')
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid id format/i);
  });

  test('blocks an AUDITOR user accessing an audit that belongs to a different org', async () => {
    const orgA = await createOrg('Scope A');
    const orgB = await createOrg('Scope B');
    const auditB = await createAudit({ organizationId: orgB._id });
    const auditor = await createUser({ organizationId: orgA._id, role: 'AUDITOR' });
    await createAuditorAssignment({
      organizationId: orgA._id,
      auditId: auditB._id,
      auditor,
    });

    const response = await request(app)
      .get(`/test/audits/${auditB._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not active/i);
  });

  test('allows an AUDITOR user with a valid, in-window assignment', async () => {
    const org = await createOrg();
    const audit = await createAudit({ organizationId: org._id });
    const auditor = await createUser({ organizationId: org._id, role: 'AUDITOR' });
    const { assignment } = await createAuditorAssignment({
      organizationId: org._id,
      auditId: audit._id,
      auditor,
    });

    const response = await request(app)
      .get(`/test/audits/${audit._id}`)
      .set('Authorization', `Bearer ${signToken(auditor)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      auditId: audit._id.toString(),
      assignmentId: assignment._id.toString(),
    });
  });
});

describe('Org scope isolation (integration)', () => {
  test("auditors can only retrieve evidence for audits they're assigned to", async () => {
    const orgA = await createOrg('Evidence Org A');
    const orgB = await createOrg('Evidence Org B');
    const auditA = await createAudit({ organizationId: orgA._id, name: 'Org A audit' });
    const auditB = await createAudit({ organizationId: orgB._id, name: 'Org B audit' });
    await createEvidenceItems({ organizationId: orgA._id, auditId: auditA._id, prefix: 'A' });
    const evidenceB = await createEvidenceItems({ organizationId: orgB._id, auditId: auditB._id, prefix: 'B' });

    const auditorA = await createUser({
      organizationId: orgA._id,
      role: 'AUDITOR',
      email: 'auditor-a@example.com',
    });
    await createAuditorAssignment({ organizationId: orgA._id, auditId: auditA._id, auditor: auditorA });

    const auditorB = await createUser({
      organizationId: orgB._id,
      role: 'AUDITOR',
      email: 'auditor-b@example.com',
    });
    await createAuditorAssignment({ organizationId: orgB._id, auditId: auditB._id, auditor: auditorB });

    const blocked = await request(app)
      .get(`/api/v1/auditor/engagements/${auditB._id}/evidence`)
      .set('Authorization', `Bearer ${signToken(auditorA)}`);

    expect([200, 403]).toContain(blocked.status);
    if (blocked.status === 200) {
      expect(blocked.body.data).toEqual([]);
    } else {
      expect(blocked.body.success).toBe(false);
    }

    const allowed = await request(app)
      .get(`/api/v1/auditor/engagements/${auditB._id}/evidence`)
      .set('Authorization', `Bearer ${signToken(auditorB)}`);

    expect(allowed.status).toBe(200);
    expect(allowed.body.success).toBe(true);
    expect(allowed.body.data).toHaveLength(2);
    expect(allowed.body.data.map((item) => item._id).sort()).toEqual(
      evidenceB.map((item) => item._id.toString()).sort()
    );
    expect(allowed.body.data.every((item) => item.organizationId === orgB._id.toString())).toBe(true);
  });
});

describe('Role change logging', () => {
  test("records the platform's role-change audit log when an admin updates a user's role", async () => {
    const org = await createOrg();
    const admin = await createUser({ organizationId: org._id, role: 'ADMIN', email: 'admin@example.com' });
    const target = await createUser({ organizationId: org._id, role: 'EMPLOYEE', email: 'member@example.com' });

    const response = await request(app)
      .patch(`/api/v1/users/${target._id}/role`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ role: 'MANAGER' });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('MANAGER');

    const log = await ActivityLog.findOne({
      organizationId: org._id,
      actorId: admin._id,
      entityType: 'User',
      entityId: target._id,
      action: 'UPDATE',
    }).lean();

    expect(log).toMatchObject({
      action: 'UPDATE',
      entityType: 'User',
      entityId: target._id,
    });

    const updatedUser = await User.findById(target._id).lean();
    expect(updatedUser.role).toBe('MANAGER');
  });
});
