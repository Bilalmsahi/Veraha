import crypto from 'crypto';
import User from '../models/User.js';
import Invitation from '../models/Invitation.js';
import Organization from '../models/Organization.js';
import { sendEmail } from './emailService.js';
import { logActivity } from './activityLogger.js';

export const INVITE_INITIAL_TTL_MS = Number(process.env.INVITE_INITIAL_TTL_MS || 60 * 60 * 1000);
export const INVITE_ACCESSED_INACTIVITY_MS = Number(process.env.INVITE_ACCESSED_INACTIVITY_MS || 3 * 24 * 60 * 60 * 1000);
const RESEND_COOLDOWN_MS = Number(process.env.INVITE_RESEND_COOLDOWN_MS || 5 * 60 * 1000);
const MAX_RESENDS = Number(process.env.INVITE_MAX_RESENDS || 5);

function appUrl() {
  return (process.env.APP_URL || process.env.CLIENT_URL || 'https://app.veraha.ai').replace(/\/$/, '');
}

function createToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function actorSnapshot(actor) {
  return {
    email: actor.email,
    name: actor.fullName || `${actor.firstName} ${actor.lastName}`,
    role: actor.role,
  };
}

function sanitizeInvitation(invitation) {
  const raw = invitation?.toObject ? invitation.toObject() : invitation;
  if (!raw) return null;
  delete raw.tokenHash;
  return raw;
}

function invitationPublicPayload(invitation, organization, user) {
  return {
    status: invitation.status,
    email: invitation.email,
    role: invitation.role,
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    organization: organization ? { _id: organization._id, name: organization.name, setupComplete: organization.setupComplete } : null,
    expiresAt: invitation.expiresAt,
    sentAt: invitation.sentAt,
  };
}

async function writeInvitationLog(invitation, actor, action, notes, metadata = {}) {
  return logActivity({
    organizationId: invitation.organizationId,
    actorId: actor?._id || null,
    actorSnapshot: actor ? actorSnapshot(actor) : { name: 'System' },
    action,
    entityType: 'Invitation',
    entityId: invitation._id,
    entitySnapshot: {
      title: invitation.email,
      identifier: invitation.status,
    },
    metadata,
    notes,
  });
}

async function sendInvitationEmail(invitation, inviter, token) {
  const organization = await Organization.findById(invitation.organizationId).lean();
  const inviteUrl = `${appUrl()}/invite/${token}`;
  const recipientName = invitation.email.split('@')[0];
  const inviterName = inviter.fullName || `${inviter.firstName} ${inviter.lastName}`;
  const orgName = organization?.name || 'your organization';
  const expiryText = 'This invitation link expires in 1 hour. After opening it, finish accepting the invitation within 3 days.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color:#111827; margin:0 0 12px;">Join ${orgName}</h2>
      <p style="color:#374151; line-height:1.6;">${inviterName} invited you to join ${orgName} on Veraha Security.</p>
      <p style="margin:28px 0;">
        <a href="${inviteUrl}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a>
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">${expiryText}</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">If you were not expecting this invitation, do not open the link. Contact your administrator or support.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="color:#9ca3af;font-size:12px;">For safety, open this link only in a browser you trust. Never forward invitation emails.</p>
    </div>
  `;

  const text = [
    `${inviterName} invited you to join ${orgName} on Veraha Security.`,
    '',
    `Accept invitation: ${inviteUrl}`,
    '',
    expiryText,
    'If you were not expecting this invitation, do not open the link.',
  ].join('\n');

  await sendEmail({
    to: invitation.email,
    toName: recipientName,
    subject: `Join ${orgName} on Veraha Security`,
    html,
    text,
  });
}

export async function createInvitation({ email, role, firstName, lastName }, inviter) {
  const normalizedEmail = email.toLowerCase().trim();

  const existingActive = await User.findOne({
    email: normalizedEmail,
    organizationId: inviter.organizationId,
    isDeleted: false,
    status: { $ne: 'INVITED' },
  });

  if (existingActive) {
    const err = new Error('User with this email already exists in your organization');
    err.statusCode = 409;
    throw err;
  }

  const existingGlobal = await User.findOne({
    email: normalizedEmail,
    organizationId: { $ne: inviter.organizationId },
    isDeleted: false,
  });
  const reusableAuditor = role === 'AUDITOR' && existingGlobal?.role === 'AUDITOR';
  if (existingGlobal && !reusableAuditor) {
    const err = new Error('Email is already registered with another organization');
    err.statusCode = 409;
    throw err;
  }

  await Invitation.updateMany(
    { organizationId: inviter.organizationId, email: normalizedEmail, status: { $in: ['PENDING', 'ACCESSED'] } },
    { $set: { status: 'REVOKED', revokedAt: new Date(), revokedBy: inviter._id, failureReason: 'Superseded by a new invitation' } },
  );

  const tempPassword = `Temp${Date.now()}!Aa1`;
  let user = reusableAuditor ? existingGlobal : await User.findOne({
    email: normalizedEmail,
    organizationId: inviter.organizationId,
    isDeleted: false,
    status: 'INVITED',
  });

  if (!user) {
    user = new User({
      organizationId: inviter.organizationId,
      email: normalizedEmail,
      password: tempPassword,
      firstName,
      lastName,
      role,
      status: 'INVITED',
      invitedBy: inviter._id,
      invitedAt: new Date(),
    });
  } else if (user.organizationId.toString() === inviter.organizationId.toString() && user.status === 'INVITED') {
    user.firstName = firstName;
    user.lastName = lastName;
    user.role = role;
    user.invitedBy = inviter._id;
    user.invitedAt = new Date();
  }

  const { token, tokenHash } = createToken();
  if (user.status === 'INVITED') {
    user.inviteToken = tokenHash;
    user.inviteExpiresAt = new Date(Date.now() + INVITE_INITIAL_TTL_MS);
    await user.save();
  }

  const invitation = await Invitation.create({
    organizationId: inviter.organizationId,
    userId: user._id,
    email: normalizedEmail,
    role,
    tokenHash,
    invitedBy: inviter._id,
    sentAt: new Date(),
    expiresAt: user.status === 'INVITED' ? user.inviteExpiresAt : new Date(Date.now() + INVITE_INITIAL_TTL_MS),
  });

  await sendInvitationEmail(invitation, inviter, token);
  await writeInvitationLog(invitation, inviter, 'CREATE', 'Invitation sent', { userId: user._id });

  return { user, invitation: sanitizeInvitation(invitation) };
}

export async function findInvitationByToken(token, options = {}) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');
  if (!invitation) return null;

  const now = new Date();
  if (['PENDING', 'ACCESSED'].includes(invitation.status) && invitation.expiresAt <= now) {
    const previousStatus = invitation.status;
    invitation.status = 'EXPIRED';
    invitation.failureReason = previousStatus === 'ACCESSED' ? 'Invitation inactivity window elapsed' : 'Invitation link expired';
    await invitation.save();
  }

  if (options.markAccessed && invitation.status === 'PENDING') {
    invitation.status = 'ACCESSED';
    invitation.firstAccessedAt = now;
    invitation.lastActivityAt = now;
    invitation.expiresAt = new Date(now.getTime() + INVITE_ACCESSED_INACTIVITY_MS);
    await invitation.save();
    await writeInvitationLog(invitation, null, 'UPDATE', 'Invitation link first accessed');
  }

  return invitation;
}

export async function validateInvitation(token, metadata = {}) {
  const invitation = await findInvitationByToken(token, { markAccessed: true });
  if (!invitation || !['PENDING', 'ACCESSED'].includes(invitation.status)) {
    const err = new Error(invitation?.status === 'EXPIRED' ? 'Invitation expired' : 'Invalid invitation link');
    err.statusCode = invitation?.status === 'EXPIRED' ? 410 : 400;
    err.code = invitation?.status || 'INVALID';
    throw err;
  }

  if (metadata.ipAddress || metadata.userAgent) {
    invitation.metadata = { ...(invitation.metadata || {}), ...metadata };
    invitation.lastActivityAt = new Date();
    await invitation.save();
  }

  const [organization, user] = await Promise.all([
    Organization.findById(invitation.organizationId).lean(),
    User.findById(invitation.userId).lean(),
  ]);

  return invitationPublicPayload(invitation, organization, user);
}

export async function acceptInvitation({ token, password, firstName, lastName }) {
  const invitation = await findInvitationByToken(token);
  if (!invitation || !['PENDING', 'ACCESSED'].includes(invitation.status)) {
    const err = new Error(invitation?.status === 'EXPIRED' ? 'Invitation expired' : 'Invalid or already used invite link');
    err.statusCode = invitation?.status === 'EXPIRED' ? 410 : 400;
    throw err;
  }

  const user = await User.findOne({
    _id: invitation.userId,
    isDeleted: false,
  });
  if (!user) {
    const err = new Error('Invitation user is no longer available');
    err.statusCode = 400;
    throw err;
  }

  if (user.status === 'INVITED') {
    user.password = password;
    user.status = 'ACTIVE';
    user.inviteToken = undefined;
    user.inviteExpiresAt = undefined;
    user.lastActivityAt = new Date();
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    await user.save();
  } else if (!(user.role === 'AUDITOR' && user.status === 'ACTIVE')) {
    const err = new Error('Invitation user is no longer available');
    err.statusCode = 400;
    throw err;
  }

  invitation.status = 'COMPLETED';
  invitation.completedAt = new Date();
  invitation.lastActivityAt = invitation.completedAt;
  invitation.tokenHash = crypto.randomBytes(32).toString('hex');
  await invitation.save();
  await Organization.updateOne(
    { _id: user.organizationId, status: 'pending' },
    { $set: { status: 'active' } },
  );
  await writeInvitationLog(invitation, user, 'UPDATE', 'Invitation completed', { userId: user._id });

  return { user, organization: await Organization.findById(user.organizationId) };
}

export async function resendInvitation(userId, actor) {
  const user = await User.findOne({
    _id: userId,
    organizationId: actor.organizationId,
    isDeleted: false,
    status: 'INVITED',
  });

  if (!user) {
    const err = new Error('Invited user not found');
    err.statusCode = 404;
    throw err;
  }

  const previous = await Invitation.findOne({
    userId: user._id,
    organizationId: actor.organizationId,
    status: { $in: ['PENDING', 'ACCESSED', 'EXPIRED'] },
  }).sort({ createdAt: -1 }).select('+tokenHash');

  if (previous?.lastResentAt && Date.now() - previous.lastResentAt.getTime() < RESEND_COOLDOWN_MS) {
    const err = new Error('Please wait before resending this invitation');
    err.statusCode = 429;
    throw err;
  }
  if ((previous?.resendCount || 0) >= MAX_RESENDS) {
    const err = new Error('Maximum invitation resend attempts reached');
    err.statusCode = 429;
    throw err;
  }

  if (previous) {
    previous.status = 'REVOKED';
    previous.revokedAt = new Date();
    previous.revokedBy = actor._id;
    previous.failureReason = 'Superseded by resend';
    previous.tokenHash = crypto.randomBytes(32).toString('hex');
    await previous.save();
  }

  const { token, tokenHash } = createToken();
  const now = new Date();
  user.inviteToken = tokenHash;
  user.inviteExpiresAt = new Date(now.getTime() + INVITE_INITIAL_TTL_MS);
  user.invitedAt = now;
  user.invitedBy = actor._id;
  await user.save();

  const invitation = await Invitation.create({
    organizationId: actor.organizationId,
    userId: user._id,
    email: user.email,
    role: user.role,
    tokenHash,
    invitedBy: actor._id,
    sentAt: now,
    expiresAt: user.inviteExpiresAt,
    resendCount: (previous?.resendCount || 0) + 1,
    lastResentAt: now,
  });

  await sendInvitationEmail(invitation, actor, token);
  await writeInvitationLog(invitation, actor, 'UPDATE', 'Invitation resent', { previousInvitationId: previous?._id });
  return sanitizeInvitation(invitation);
}

export async function revokeInvitation(userId, actor) {
  const invitation = await Invitation.findOne({
    userId,
    organizationId: actor.organizationId,
    status: { $in: ['PENDING', 'ACCESSED', 'EXPIRED'] },
  }).sort({ createdAt: -1 }).select('+tokenHash');

  if (!invitation) {
    const err = new Error('Open invitation not found');
    err.statusCode = 404;
    throw err;
  }

  invitation.status = 'REVOKED';
  invitation.revokedAt = new Date();
  invitation.revokedBy = actor._id;
  invitation.failureReason = 'Revoked by administrator';
  invitation.tokenHash = crypto.randomBytes(32).toString('hex');
  await invitation.save();

  await User.updateOne(
    { _id: userId, organizationId: actor.organizationId, status: 'INVITED' },
    { $unset: { inviteToken: '', inviteExpiresAt: '' } },
  );

  await writeInvitationLog(invitation, actor, 'DELETE', 'Invitation revoked');
  return sanitizeInvitation(invitation);
}

export async function touchInvitationActivity(token) {
  const invitation = await findInvitationByToken(token);
  if (!invitation || invitation.status !== 'ACCESSED') return null;
  invitation.lastActivityAt = new Date();
  invitation.expiresAt = new Date(Date.now() + INVITE_ACCESSED_INACTIVITY_MS);
  await invitation.save();
  return sanitizeInvitation(invitation);
}

export async function expireStaleInvitations() {
  const now = new Date();
  const result = await Invitation.updateMany(
    {
      status: { $in: ['PENDING', 'ACCESSED'] },
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'EXPIRED',
        failureReason: 'Invitation expired automatically',
      },
    },
  );
  return result;
}

export async function latestInvitationByUserIds(userIds) {
  const invitations = await Invitation.find({ userId: { $in: userIds } })
    .sort({ createdAt: -1 })
    .lean();
  const byUserId = new Map();
  for (const invitation of invitations) {
    const key = invitation.userId.toString();
    if (!byUserId.has(key)) byUserId.set(key, invitation);
  }
  return byUserId;
}

export default {
  createInvitation,
  validateInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
  touchInvitationActivity,
  expireStaleInvitations,
  latestInvitationByUserIds,
};
