import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { getJwtSecret } from '../src/config/auth.js';
import { requireAuth } from '../src/middleware/authMiddleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import authRoutes from '../src/routes/authRoutes.js';
import { Organization, RefreshToken, User } from '../src/models/index.js';
import authService from '../src/services/authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const describeIfMongo = describe;

let app;
let mongo;
let sequence = 0;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  await mongo?.stop();
});

beforeEach(async () => {
  sequence = 0;

  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }

  app = buildTestApp();
}, 30000);

function buildTestApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.get('/test/auth', requireAuth, (req, res) => {
    res.status(200).json({ userId: req.user._id.toString() });
  });
  testApp.use('/api/v1/auth', authRoutes);
  testApp.use(errorHandler);
  return testApp;
}

function unique(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      orgId: user.organizationId.toString(),
      role: user.role,
    },
    getJwtSecret(),
  );
}

async function createOrg(name = unique('Org')) {
  return Organization.create({
    name,
    domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example.com`,
  });
}

async function createUser({
  organizationId,
  role = 'EMPLOYEE',
  email,
  lastActivityAt = new Date(),
  settings,
} = {}) {
  const orgId = organizationId || (await createOrg())._id;
  if (settings?.sessionTimeoutMinutes) {
    await Organization.findByIdAndUpdate(orgId, {
      $set: { 'settings.sessionTimeoutMinutes': settings.sessionTimeoutMinutes },
    });
  }
  return User.create({
    organizationId: orgId,
    email: email || `${unique(role.toLowerCase())}@example.com`,
    password: 'ValidPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role,
    status: 'ACTIVE',
    lastActivityAt,
    lastLoginAt: lastActivityAt,
    settings,
  });
}

describeIfMongo('session timeout auth enforcement', () => {
  test('rejects protected requests when the session is inactive', async () => {
    const user = await createUser({
      lastActivityAt: new Date(Date.now() - 31 * 60 * 1000),
      settings: { sessionTimeoutMinutes: 30 },
    });

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/inactivity/i);
    expect(response.body.meta).toEqual({ reason: 'session_timeout' });
  });

  test('allows protected requests when activity is recent', async () => {
    const user = await createUser({
      lastActivityAt: new Date(),
      settings: { sessionTimeoutMinutes: 30 },
    });

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(user._id.toString());
  });

  test('uses the 24-hour default for users without saved settings', async () => {
    const user = await createUser({
      lastActivityAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    });

    const response = await request(app)
      .get('/test/auth')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(200);
  });
});

describeIfMongo('session timeout settings API', () => {
  test('updates the current user session timeout preference', async () => {
    const user = await createUser({ role: 'ADMIN' });
    const token = signToken(user);

    const response = await request(app)
      .patch('/api/v1/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionTimeoutMinutes: 60 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.settings.sessionTimeoutMinutes).toBe(60);

    const refreshed = await User.findById(user._id);
    expect(refreshed.settings.sessionTimeoutMinutes).toBe(60);
  });

  test('rejects invalid timeout values', async () => {
    const user = await createUser();
    const token = signToken(user);

    const response = await request(app)
      .patch('/api/v1/auth/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionTimeoutMinutes: 45 });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.success).toBe(false);
  });
});

describeIfMongo('session activity API', () => {
  test('refreshes server-side lastActivityAt', async () => {
    const staleActivity = new Date(Date.now() - 20 * 60 * 1000);
    const user = await createUser({
      lastActivityAt: staleActivity,
      settings: { sessionTimeoutMinutes: 30 },
    });
    const token = signToken(user);

    const response = await request(app)
      .post('/api/v1/auth/activity')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.touched).toBe(true);

    const refreshed = await User.findById(user._id);
    expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime());
  });
});

describeIfMongo('session timeout refresh flow', () => {
  test('blocks refresh token rotation after inactivity timeout', async () => {
    const user = await createUser({
      lastActivityAt: new Date(Date.now() - 31 * 60 * 1000),
      settings: { sessionTimeoutMinutes: 30 },
    });

    const refreshToken = `refresh-${unique('token')}`;
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/inactivity/i);
    expect(response.body.meta).toEqual({ reason: 'session_timeout' });

    const stored = await RefreshToken.findOne({ token: refreshToken });
    expect(stored.revokedAt).toBeTruthy();
  });

  test('allows refresh token rotation for active sessions', async () => {
    const user = await createUser({
      lastActivityAt: new Date(),
      settings: { sessionTimeoutMinutes: 30 },
    });

    const { refreshToken } = await authService.generateTokenPair(user);

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.token).toBeTruthy();
  });
});
