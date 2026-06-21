/**
 * Migration: backfill PolicyVersion editor/upload content metadata.
 *
 * Run:
 *   node server/scripts/migratePolicyVersionContentType.js
 *
 * Dry run:
 *   node server/scripts/migratePolicyVersionContentType.js --dry-run
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import PolicyVersion from '../src/models/PolicyVersion.js';
import { hashPolicyHtml, sanitizePolicyHtml } from '../src/utils/policyHtmlSanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

function hasHtml(doc) {
  return typeof doc.contentHtml === 'string' && doc.contentHtml.trim() !== '';
}

function inferContentType(doc) {
  if (hasHtml(doc)) return 'EDITOR_HTML';
  if (doc.fileKey) return 'UPLOADED_FILE';
  return 'EDITOR_HTML';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Migration] Connected. DRY_RUN=${DRY_RUN}`);

  try {
    const docs = await PolicyVersion.collection
      .find(
        {
          $or: [
            { contentType: { $exists: false } },
            { contentHash: { $in: [null, ''] } },
            { contentType: null },
          ],
        },
        { projection: { _id: 1, contentHtml: 1, contentType: 1, contentHash: 1, fileKey: 1 } }
      )
      .toArray();

    let editorHtml = 0;
    let uploadedFile = 0;
    let sanitizedChanged = 0;

    const updates = docs.map((doc) => {
      const contentType = doc.contentType || inferContentType(doc);
      const set = { contentType };

      if (contentType === 'EDITOR_HTML') {
        editorHtml += 1;
        const sanitized = sanitizePolicyHtml(doc.contentHtml || '');
        set.contentHtml = sanitized;
        set.contentHash = hashPolicyHtml(sanitized);
        if (sanitized !== (doc.contentHtml || '')) sanitizedChanged += 1;
      } else {
        uploadedFile += 1;
      }

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: set },
        },
      };
    });

    console.log(`[Migration] PolicyVersions scanned: ${docs.length}`);
    console.log(`[Migration] Classified as EDITOR_HTML: ${editorHtml}`);
    console.log(`[Migration] Classified as UPLOADED_FILE: ${uploadedFile}`);
    console.log(`[Migration] HTML values changed by sanitizer: ${sanitizedChanged}`);

    if (DRY_RUN) {
      console.log('[Migration] DRY RUN - no writes performed.');
      return;
    }

    if (!updates.length) {
      console.log('[Migration] Nothing to update.');
      return;
    }

    const result = await PolicyVersion.bulkWrite(updates);
    console.log(`[Migration] PolicyVersions updated: modified=${result.modifiedCount}`);
    console.log('[Migration] Done.');
  } catch (error) {
    console.error('[Migration] Failed.', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
