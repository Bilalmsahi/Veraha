/**
 * Migration: copy Policy.approverId -> Policy.approverIds when approverIds is empty.
 *
 * Run:
 *   node server/scripts/migratePolicyApproverIds.js
 *
 * Dry run:
 *   node server/scripts/migratePolicyApproverIds.js --dry-run
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

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  try {
    const docs = await Policy.collection
      .find(
        { isDeleted: { $ne: true }, approverId: { $ne: null } },
        { projection: { _id: 1, approverId: 1, approverIds: 1 } }
      )
      .toArray();

    const updates = docs
      .map((doc) => {
        const hasApproverIds = Array.isArray(doc.approverIds) && doc.approverIds.length > 0;
        if (hasApproverIds || !doc.approverId) return null;

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { approverIds: [doc.approverId] } },
          },
        };
      })
      .filter(Boolean);

    console.log(`[Migration] Policies scanned: ${docs.length}`);
    console.log(`[Migration] Policies to update: ${updates.length}`);

    if (DRY_RUN) {
      console.log('[Migration] DRY RUN — no writes performed.');
      return;
    }

    if (!updates.length) {
      console.log('[Migration] Nothing to update.');
      return;
    }

    const result = await Policy.bulkWrite(updates);
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
