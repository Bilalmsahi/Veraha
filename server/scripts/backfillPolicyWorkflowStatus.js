/**
 * Migration: Backfill Policy.workflowStatus from legacy Policy.status
 *
 * Run:
 *   node server/scripts/backfillPolicyWorkflowStatus.js
 *
 * Dry run:
 *   node server/scripts/backfillPolicyWorkflowStatus.js --dry-run
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Policy from '../src/models/Policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const WORKFLOW_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED']);

function mapStatusToWorkflowStatus(status) {
  if (WORKFLOW_STATUSES.has(status)) return status;
  return 'DRAFT';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  try {
    const policies = await Policy.find({ isDeleted: { $ne: true } }).select('_id status workflowStatus').lean();
    console.log(`[Migration] Policies scanned: ${policies.length}`);

    const updates = policies
      .map((policy) => {
        const nextWorkflowStatus = mapStatusToWorkflowStatus(policy.status);
        return {
          id: policy._id,
          current: policy.workflowStatus,
          next: nextWorkflowStatus,
        };
      })
      .filter((item) => item.current !== item.next);

    console.log(`[Migration] Policies to update: ${updates.length}`);
    if (DRY_RUN) {
      console.log('[Migration] DRY RUN — no writes performed.');
      return;
    }

    if (!updates.length) {
      console.log('[Migration] Nothing to update.');
      return;
    }

    const ops = updates.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { workflowStatus: item.next } },
      },
    }));

    const result = await Policy.bulkWrite(ops);
    console.log(`[Migration] Policies updated: modified=${result.modifiedCount}`);
    console.log('[Migration] Done.');
  } catch (error) {
    console.error('[Migration] Failed.', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
