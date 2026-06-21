import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PolicyAttestation from '../src/models/PolicyAttestation.js';
import Test from '../src/models/Test.js';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

function isUnambiguousLegacyNa(test) {
  if (test.archivedAt || test.notApplicableAt) return false;
  if (test.status !== 'na') return false;
  if (test.isActive === false || test.snoozedUntil) return false;
  return true;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';
  await mongoose.connect(mongoUri);

  const attestationsMissingSource = await PolicyAttestation.countDocuments({
    $or: [{ source: { $exists: false } }, { source: null }],
  });

  const candidateNaTests = await Test.find({
    status: 'na',
    archivedAt: null,
    notApplicableAt: null,
  })
    .select('_id name status isActive snoozedUntil archivedAt notApplicableAt updatedAt')
    .lean();

  const unambiguousNaTests = candidateNaTests.filter(isUnambiguousLegacyNa);
  const ambiguousNaTests = candidateNaTests.filter((test) => !isUnambiguousLegacyNa(test));

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        policyAttestationsToSetUserSource: attestationsMissingSource,
        notApplicableTestsToBackfill: unambiguousNaTests.length,
        ambiguousNaTestsForManualReview: ambiguousNaTests.map((test) => ({
          id: String(test._id),
          name: test.name,
          status: test.status,
          isActive: test.isActive,
          snoozedUntil: test.snoozedUntil,
          updatedAt: test.updatedAt,
        })),
      },
      null,
      2
    )
  );

  if (DRY_RUN) {
    await mongoose.disconnect();
    return;
  }

  await PolicyAttestation.updateMany(
    { $or: [{ source: { $exists: false } }, { source: null }] },
    { $set: { source: 'USER' } }
  );

  const now = new Date();
  if (unambiguousNaTests.length) {
    await Test.updateMany(
      { _id: { $in: unambiguousNaTests.map((test) => test._id) } },
      {
        $set: {
          notApplicableAt: now,
          notApplicableReason: 'Backfilled from unambiguous legacy N/A status',
        },
      }
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
