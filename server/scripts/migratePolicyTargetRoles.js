/**
 * Migration: copy Policy.assignmentRoles -> Policy.targetRoles for SPECIFIC_ROLES policies.
 *
 * Run:
 *   node server/scripts/migratePolicyTargetRoles.js
 *
 * Dry run:
 *   node server/scripts/migratePolicyTargetRoles.js --dry-run
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
const VALID_ROLES = new Set(['ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR']);

function normalizeRoles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((role) => VALID_ROLES.has(role)))];
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  try {
    const docs = await Policy.collection
      .find(
        {
          isDeleted: { $ne: true },
          assignmentScope: 'SPECIFIC_ROLES',
        },
        { projection: { _id: 1, assignmentScope: 1, assignmentRoles: 1, targetRoles: 1 } }
      )
      .toArray();

    const updates = docs
      .map((doc) => {
        const legacyRoles = normalizeRoles(doc.assignmentRoles);
        const existingTargetRoles = normalizeRoles(doc.targetRoles);
        const mergedTargetRoles = [...new Set([...existingTargetRoles, ...legacyRoles])];
        const needsSet =
          JSON.stringify(existingTargetRoles.sort()) !== JSON.stringify(mergedTargetRoles.sort());
        const needsUnset = Object.prototype.hasOwnProperty.call(doc, 'assignmentRoles');

        if (!needsSet && !needsUnset) return null;

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              ...(needsSet ? { $set: { targetRoles: mergedTargetRoles } } : {}),
              ...(needsUnset ? { $unset: { assignmentRoles: 1 } } : {}),
            },
          },
        };
      })
      .filter(Boolean);

    console.log(`[Migration] SPECIFIC_ROLES policies scanned: ${docs.length}`);
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
