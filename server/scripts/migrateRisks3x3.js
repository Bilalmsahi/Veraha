/**
 * Migration: 5x5 → 3x3 Risk Scale
 * Run: node server/scripts/migrateRisks3x3.js
 * Dry run: node server/scripts/migrateRisks3x3.js --dry-run
 */
import mongoose from 'mongoose';
import Risk from '../src/models/Risk.js';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const downscale = (v) => {
  if (v == null) return null;
  if (v <= 2) return 1;
  if (v === 3) return 2;
  return 3;
};
const scoreToBand = (score) => (score >= 7 ? 'High' : score >= 3 ? 'Medium' : 'Low');
const scoreToRiskLevel = (score) => (score >= 7 ? 'HIGH' : score >= 3 ? 'MED' : 'LOW');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  const risks = await Risk.find({
    isDeleted: { $ne: true },
    '_migration.migratedAt': { $exists: false },
  }).lean();

  if (risks.length === 0) {
    console.log('[Migration] Nothing to migrate. Exiting.');
    process.exit(0);
  }

  const criticalRisks = risks.filter((r) => (r.inherentScore ?? 0) >= 20);
  console.log(
    `[Migration] Found ${risks.length} unmigrated risks. ${criticalRisks.length} CRITICAL risks will be OPENED for review.`
  );

  if (DRY_RUN) {
    console.log('[Migration] DRY RUN — no writes performed.');
    process.exit(0);
  }

  const session = await mongoose.startSession();
  let migratedCount = 0;

  try {
    await session.withTransaction(async () => {
      const ops = risks.map((risk) => {
        const newL = downscale(risk.likelihood ?? 3);
        const newI = downscale(risk.impact ?? 3);
        const newScore = newL * newI;
        const wasCritical = (risk.inherentScore ?? 0) >= 20;

        return {
          updateOne: {
            filter: { _id: risk._id },
            update: {
              $set: {
                likelihood: newL,
                impact: newI,
                inherentScore: newScore,
                'inherentRisk.likelihood': newL,
                'inherentRisk.impact': newI,
                'inherentRisk.score': newScore,
                'inherentRisk.level': scoreToBand(newScore),
                residualLikelihood: null,
                residualImpact: null,
                residualScore: null,
                residualRisk: null,
                riskLevel: scoreToRiskLevel(newScore),
                ...(wasCritical && { status: 'OPEN', closedAt: null }),
                _migration: {
                  migratedAt: new Date(),
                  originalLikelihood: risk.likelihood,
                  originalImpact: risk.impact,
                  originalScore: risk.inherentScore,
                  originalRiskLevel: risk.riskLevel,
                  wasCritical,
                },
              },
            },
          },
        };
      });
      const result = await Risk.bulkWrite(ops, { session });
      migratedCount = result.modifiedCount;
    });
    console.log(`[Migration] ✅ Success. Migrated: ${migratedCount}.`);
  } catch (err) {
    console.error('[Migration] ❌ Transaction failed.', err);
  } finally {
    session.endSession();
    process.exit(0);
  }
}
migrate();
