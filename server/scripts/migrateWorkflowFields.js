/**
 * Migration: Unify status (remove workflowStatus fields)
 *
 * Run:
 *   node server/scripts/migrateWorkflowFields.js
 *
 * Dry run:
 *   node server/scripts/migrateWorkflowFields.js --dry-run
 *
 * Notes:
 * - Copies `workflowStatus` → `status` when present.
 * - Unsets `workflowStatus` and `previousWorkflowStatus` on Policy.
 * - Unsets `workflowStatus` on PolicyVersion.
 * - Backfills PolicyVersion.approverId from Policy.approverId only when version is PENDING_APPROVAL
 *   and approverId is missing.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Policy from '../src/models/Policy.js';
import PolicyVersion from '../src/models/PolicyVersion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
function normalizeStatus(status) {
  return status || 'DRAFT';
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const policies = await Policy.find({
        isDeleted: { $ne: true },
        workflowStatus: { $exists: true, $ne: null },
      })
        .select('_id status workflowStatus previousWorkflowStatus approverId')
        .lean({ virtuals: false });

      const versions = await PolicyVersion.find({
        isDeleted: { $ne: true },
        workflowStatus: { $exists: true, $ne: null },
      })
        .select('_id policyId status workflowStatus approverId')
        .lean({ virtuals: false });

      console.log(`[Migration] Policies to unify: ${policies.length}`);
      console.log(`[Migration] PolicyVersions to unify: ${versions.length}`);

      if (DRY_RUN) {
        console.log('[Migration] DRY RUN — no writes performed.');
        return;
      }

      if (policies.length) {
        const ops = policies.map((p) => {
          return {
            updateOne: {
              filter: { _id: p._id },
              update: {
                $set: { status: normalizeStatus(p.workflowStatus) },
                $unset: { workflowStatus: 1, previousWorkflowStatus: 1 },
              },
            },
          };
        });
        const result = await Policy.bulkWrite(ops, { session });
        console.log(`[Migration] Policies updated: modified=${result.modifiedCount}`);
      }

      if (versions.length) {
        const policyApproverById = new Map(policies.map((p) => [String(p._id), p.approverId ? String(p.approverId) : null]));
        const ops = versions.map((v) => {
          const nextStatus = normalizeStatus(v.workflowStatus);
          const maybeApprover =
            nextStatus === 'PENDING_APPROVAL' && !v.approverId
              ? policyApproverById.get(String(v.policyId)) || null
              : null;

          return {
            updateOne: {
              filter: { _id: v._id },
              update: {
                $set: {
                  status: nextStatus,
                  ...(maybeApprover ? { approverId: maybeApprover } : {}),
                },
                $unset: { workflowStatus: 1 },
              },
            },
          };
        });
        const result = await PolicyVersion.bulkWrite(ops, { session });
        console.log(`[Migration] PolicyVersions updated: modified=${result.modifiedCount}`);
      }
    });

    console.log('[Migration] ✅ Done.');
  } catch (err) {
    console.error('[Migration] ❌ Failed.', err);
  } finally {
    session.endSession();
    process.exit(0);
  }
}

migrate();

