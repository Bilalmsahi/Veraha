import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import AuditAssignment from '../src/models/AuditAssignment.js';
import AuditorProfile from '../src/models/AuditorProfile.js';
import AuditorTenantMembership from '../src/models/AuditorTenantMembership.js';

dotenv.config();

const MAX_ATTEMPTS = 3;

function isRetryableMigrationError(error) {
  return (
    error?.codeName === 'AtlasError' ||
    error?.code === 8000 ||
    error?.errorLabels?.includes?.('TransientTransactionError') ||
    /timed out|timeout|overloaded|incomplete read/i.test(error?.message || '')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateAuditor(user) {
  const session = await mongoose.startSession();
  const email = user.email.toLowerCase().trim();
  let updatedAssignments = 0;

  try {
    await session.withTransaction(async () => {
      const profile = await AuditorProfile.findOrCreate(
        email,
        {
          firstName: user.firstName,
          lastName: user.lastName,
        },
        { session }
      );

      const assignments = await AuditAssignment.find({ auditorEmail: email })
        .select('organizationId')
        .setOptions({ includeDeleted: true })
        .session(session)
        .lean();

      const organizationIds = [
        ...new Set(assignments.map((assignment) => assignment.organizationId?.toString()).filter(Boolean)),
      ];

      for (const organizationId of organizationIds) {
        await AuditorTenantMembership.findOneAndUpdate(
          {
            auditorProfile: profile._id,
            organization: organizationId,
          },
          {
            $setOnInsert: {
              auditorProfile: profile._id,
              organization: organizationId,
              status: 'ACTIVE',
              invitedBy: user.invitedBy,
              joinedAt: user.createdAt || new Date(),
            },
          },
          { upsert: true, new: true, session }
        );
      }

      const result = await AuditAssignment.updateMany(
        {
          auditorEmail: email,
          $or: [
            { auditorProfile: { $exists: false } },
            { auditorProfile: null },
            { auditorProfile: { $ne: profile._id } },
          ],
        },
        { $set: { auditorProfile: profile._id } },
        { session }
      );

      updatedAssignments = result.modifiedCount;
    });
  } finally {
    session.endSession();
  }

  console.log(`Migrated auditor ${email}: ${updatedAssignments} assignments updated`);
}

async function migrateAuditorWithRetry(user) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await migrateAuditor(user);
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isRetryableMigrationError(error)) {
        throw error;
      }

      const delayMs = attempt * 5000;
      console.warn(
        `Retrying auditor ${user.email} after transient migration error ` +
          `(attempt ${attempt}/${MAX_ATTEMPTS}, waiting ${delayMs}ms): ${error.message}`
      );
      await sleep(delayMs);
    }
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
  await mongoose.connect(mongoUri);

  const cursor = User.find({ role: 'AUDITOR', isDeleted: { $ne: true } })
    .select('email firstName lastName invitedBy createdAt')
    .cursor();

  for await (const user of cursor) {
    await migrateAuditorWithRetry(user);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[Auditor identity migration] Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
