import { Router } from 'express';
import crypto from 'crypto';
import Framework from '../models/Framework.js';
import Invitation from '../models/Invitation.js';
import Organization from '../models/Organization.js';
import OrganizationFramework from '../models/OrganizationFramework.js';
import OrganizationFrameworkReadiness from '../models/OrganizationFrameworkReadiness.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import dashboardService from '../services/dashboardService.js';
import { provisionCompleteDatasetForOrganization } from '../services/frameworkProvisioningService.js';
import { recalculateReadinessForOrg } from '../services/readinessService.js';
import { signAdminToken, verifyAdminCredentials } from './adminAuth.js';
import { requireSuperAdmin } from './adminMiddleware.js';

const router = Router();
const slugPattern = /^[a-z0-9-]+$/;

function createInviteToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function appUrl() {
  return (process.env.COMPLIANCE_APP_URL || process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

async function sendAdminInvitationEmail({ email, orgName, token }) {
  const inviteUrl = `${appUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
  const text = [
    `You've been invited to Veraha for ${orgName}.`,
    '',
    `Accept your invitation: ${inviteUrl}`,
    '',
    'This invitation expires in 72 hours.',
  ].join('\n');

  await sendEmail({
    to: email,
    toName: email.split('@')[0],
    subject: "You've been invited to Veraha",
    text,
    html: `<p>You've been invited to Veraha for ${orgName}.</p><p><a href="${inviteUrl}">Accept your invitation</a></p><p>This invitation expires in 72 hours.</p>`,
  });
}

async function activeFrameworkIdSet(organization) {
  const grants = await OrganizationFramework.find({
    organizationId: organization._id,
    revokedAt: null,
  }).select('frameworkId').lean();

  return new Set([
    ...((organization.settings?.enabledFrameworks || []).map((id) => id.toString())),
    ...(grants.map((grant) => grant.frameworkId.toString())),
  ]);
}

async function getDashboardReadiness(organizationId) {
  try {
    const summary = await dashboardService.getSummary(organizationId);
    const byCode = new Map(
      (summary.frameworkReadiness || []).map((item) => [
        item.code,
        {
          readinessPercent: item.readinessScore || 0,
          complianceScore: item.complianceScore || 0,
          gaps: item.gaps || 0,
          passingRequirements: item.passingRequirements || 0,
          totalRequirements: item.totalRequirements || 0,
          ready: Boolean(item.ready),
        },
      ]),
    );
    return {
      overallScore: summary.overallScore || 0,
      averageFrameworkReadiness: summary.frameworkReadiness?.length
        ? Math.round(
          summary.frameworkReadiness.reduce((sum, item) => sum + (item.readinessScore || 0), 0)
          / summary.frameworkReadiness.length
        )
        : 0,
      byCode,
    };
  } catch (error) {
    console.error(`[admin] failed to calculate dashboard readiness for org ${organizationId}:`, error.message);
    return {
      overallScore: 0,
      byCode: new Map(),
    };
  }
}

async function createOrgInvitation(organization, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const { token, tokenHash } = createInviteToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await Invitation.updateMany(
    { organizationId: organization._id, email: normalizedEmail, status: { $in: ['PENDING', 'ACCESSED'] } },
    { $set: { status: 'EXPIRED', failureReason: 'Superseded by super admin invitation' } },
  );

  let user = await User.findOne({
    organizationId: organization._id,
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!user) {
    user = await User.create({
      organizationId: organization._id,
      email: normalizedEmail,
      password: `Temp${Date.now()}!Aa1`,
      firstName: 'Organization',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'INVITED',
      invitedAt: new Date(),
    });
  }

  user.inviteToken = tokenHash;
  user.inviteExpiresAt = expiresAt;
  user.status = 'INVITED';
  await user.save();

  const invitation = await Invitation.create({
    organizationId: organization._id,
    userId: user._id,
    email: normalizedEmail,
    role: 'ADMIN',
    status: 'PENDING',
    tokenHash,
    sentAt: new Date(),
    expiresAt,
  });

  await sendAdminInvitationEmail({ email: normalizedEmail, orgName: organization.name, token });
  return { invitation, token };
}

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!verifyAdminCredentials(email, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ token: signAdminToken() });
});

router.use(requireSuperAdmin);

router.get('/organisations', async (req, res, next) => {
  try {
    const [organizations, frameworks] = await Promise.all([
      Organization.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .lean(),
      Framework.find({ isActive: true }).sort({ code: 1 }).lean(),
    ]);
    const frameworkById = new Map(frameworks.map((framework) => [framework._id.toString(), framework]));

    const rows = await Promise.all(organizations.map(async (org) => {
      const [purchasedSet, latestInvitation, readinessRows, liveReadiness] = await Promise.all([
        activeFrameworkIdSet(org),
        Invitation.findOne({ organizationId: org._id }).sort({ createdAt: -1 }).lean(),
        OrganizationFrameworkReadiness.find({ organizationId: org._id }).lean(),
        getDashboardReadiness(org._id),
      ]);
      const purchasedIds = [...purchasedSet];
      const readinessByFramework = new Map(readinessRows.map((row) => [row.frameworkId.toString(), row.readinessPercent || 0]));

      return {
        id: org._id,
        name: org.name,
        slug: org.slug,
        status: org.status || 'active',
        created_at: org.createdAt,
        purchasedFrameworkCount: purchasedSet.size,
        averageReadinessPercent: liveReadiness.averageFrameworkReadiness,
        assessedControlCompliancePercent: liveReadiness.overallScore,
        frameworkReadiness: purchasedIds
          .map((id) => {
            const framework = frameworkById.get(id);
            if (!framework) return null;
            const live = liveReadiness.byCode.get(framework.code);
            return {
              id,
              code: framework.code,
              name: framework.name,
              readinessPercent: live?.readinessPercent ?? readinessByFramework.get(id) ?? 0,
              complianceScore: live?.complianceScore ?? 0,
              gaps: live?.gaps ?? 0,
              passingRequirements: live?.passingRequirements ?? 0,
              totalRequirements: live?.totalRequirements ?? 0,
              ready: live?.ready ?? false,
            };
          })
          .filter(Boolean),
        latestInvitationStatus: latestInvitation?.status?.toLowerCase() || null,
      };
    }));

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/organisations', async (req, res, next) => {
  try {
    const { name, slug, adminEmail } = req.body || {};
    if (!name || !adminEmail) return res.status(400).json({ error: 'Name and admin email are required' });
    if (slug && !slugPattern.test(slug)) return res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    if (slug && await Organization.exists({ slug })) return res.status(409).json({ error: 'Slug is already taken' });

    const organization = await Organization.create({
      name,
      slug,
      status: 'pending',
      createdBy: 'super_admin',
      subscriptionTier: 'FREE',
      setupComplete: true,
    });

    const { token } = await createOrgInvitation(organization, adminEmail);
    const adminUser = await User.findOne({
      organizationId: organization._id,
      email: adminEmail.toLowerCase().trim(),
      isDeleted: false,
    }).select('_id').lean();

    await provisionCompleteDatasetForOrganization({
      organizationId: organization._id,
      actorUserId: adminUser?._id || null,
    });
    await recalculateReadinessForOrg(organization._id);

    return res.status(201).json({ organisation: organization, organization, invitationToken: token });
  } catch (error) {
    return next(error);
  }
});

router.get('/organisations/:id', async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id).lean();
    if (!organization || organization.isDeleted) return res.status(404).json({ error: 'Organisation not found' });

    const [frameworks, grants, readiness, invitations, purchasedSet, liveReadiness] = await Promise.all([
      Framework.find({ isActive: true }).sort({ code: 1 }).lean(),
      OrganizationFramework.find({ organizationId: organization._id }).lean(),
      OrganizationFrameworkReadiness.find({ organizationId: organization._id }).lean(),
      Invitation.find({ organizationId: organization._id }).sort({ createdAt: -1 }).lean(),
      activeFrameworkIdSet(organization),
      getDashboardReadiness(organization._id),
    ]);
    const grantByFramework = new Map(grants.map((grant) => [grant.frameworkId.toString(), grant]));
    const readinessByFramework = new Map(readiness.map((row) => [row.frameworkId.toString(), row]));

    return res.json({
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status || 'active',
      created_at: organization.createdAt,
      created_by: organization.createdBy || null,
      averageReadinessPercent: liveReadiness.averageFrameworkReadiness,
      assessedControlCompliancePercent: liveReadiness.overallScore,
      frameworks: frameworks.map((framework) => {
        const key = framework._id.toString();
        const grant = grantByFramework.get(key);
        const live = liveReadiness.byCode.get(framework.code);
        return {
          id: framework._id,
          name: framework.name,
          slug: framework.code,
          code: framework.code,
          purchased: purchasedSet.has(key),
          purchasedAt: grant?.purchasedAt || null,
          revokedAt: grant?.revokedAt || null,
          readinessPercent: live?.readinessPercent ?? readinessByFramework.get(key)?.readinessPercent ?? 0,
          complianceScore: live?.complianceScore ?? 0,
          gaps: live?.gaps ?? 0,
          passingRequirements: live?.passingRequirements ?? 0,
          totalRequirements: live?.totalRequirements ?? 0,
          ready: live?.ready ?? false,
        };
      }),
      invitations: invitations.map((invitation) => ({
        id: invitation._id,
        email: invitation.email,
        status: invitation.status?.toLowerCase(),
        expires_at: invitation.expiresAt,
        created_at: invitation.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/organisations/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const organization = await Organization.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!organization) return res.status(404).json({ error: 'Organisation not found' });
    return res.json(organization);
  } catch (error) {
    return next(error);
  }
});

router.post('/organisations/:id/frameworks', async (req, res, next) => {
  try {
    const { frameworkId } = req.body || {};
    const [organization, framework] = await Promise.all([
      Organization.findById(req.params.id),
      Framework.findById(frameworkId),
    ]);
    if (!organization) return res.status(404).json({ error: 'Organisation not found' });
    if (!framework) return res.status(404).json({ error: 'Framework not found' });

    if (!organization.complianceDataSeededAt) {
      await provisionCompleteDatasetForOrganization({
        organizationId: organization._id,
      });
    }

    const existingActiveGrant = await OrganizationFramework.findOne({
      organizationId: organization._id,
      frameworkId: framework._id,
      revokedAt: null,
    });

    if (existingActiveGrant) {
      await Organization.updateOne({ _id: organization._id }, { $addToSet: { 'settings.enabledFrameworks': framework._id } });
      await recalculateReadinessForOrg(organization._id);
      return res.status(200).json(existingActiveGrant);
    }

    const grant = await OrganizationFramework.findOneAndUpdate(
      { organizationId: organization._id, frameworkId: framework._id },
      { $set: { revokedAt: null, purchasedBy: 'super_admin' }, $setOnInsert: { purchasedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await Organization.updateOne({ _id: organization._id }, { $addToSet: { 'settings.enabledFrameworks': framework._id } });
    await recalculateReadinessForOrg(organization._id);
    return res.status(201).json(grant);
  } catch (error) {
    return next(error);
  }
});

router.delete('/organisations/:id/frameworks/:frameworkId', async (req, res, next) => {
  try {
    await OrganizationFramework.findOneAndUpdate(
      { organizationId: req.params.id, frameworkId: req.params.frameworkId },
      { $set: { revokedAt: new Date() } },
      { upsert: false },
    );
    await Organization.updateOne({ _id: req.params.id }, { $pull: { 'settings.enabledFrameworks': req.params.frameworkId } });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/organisations/:id/reinvite', async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organisation not found' });

    const latest = await Invitation.findOne({ organizationId: organization._id }).sort({ createdAt: -1 }).lean();
    if (!latest?.email) return res.status(400).json({ error: 'No previous invitation email found' });

    await createOrgInvitation(organization, latest.email);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
