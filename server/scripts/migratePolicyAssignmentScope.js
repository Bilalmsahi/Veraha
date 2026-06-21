/**
 * Migration: Rename Policy.assignmentTarget -> Policy.assignmentScope
 *
 * Run:
 *   node server/scripts/migratePolicyAssignmentScope.js
 *
 * Dry run:
 *   node server/scripts/migratePolicyAssignmentScope.js --dry-run
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
const VALID_SCOPES = new Set([
  'ALL_PERSONNEL',
  'SPECIFIC_GROUPS',
  'SPECIFIC_USERS',
  'SPECIFIC_ROLES',
]);

function normalizeScope(value) {
  if (VALID_SCOPES.has(value)) return value;
  return 'ALL_PERSONNEL';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  try {
    const docs = await Policy.collection
      .find(
        { isDeleted: { $ne: true } },
        { projection: { _id: 1, assignmentTarget: 1, assignmentScope: 1 } }
      )
      .toArray();

    const updates = docs
      .map((doc) => {
        const nextScope =
          doc.assignmentScope != null
            ? normalizeScope(doc.assignmentScope)
            : normalizeScope(doc.assignmentTarget);

        const needsSet = doc.assignmentScope !== nextScope;
        const needsUnset = Object.prototype.hasOwnProperty.call(doc, 'assignmentTarget');
        if (!needsSet && !needsUnset) return null;

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              ...(needsSet ? { $set: { assignmentScope: nextScope } } : {}),
              ...(needsUnset ? { $unset: { assignmentTarget: 1 } } : {}),
            },
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
