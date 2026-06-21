import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 2500;
const SOURCE_COLLECTION = 'activitylogs';
const TARGET_COLLECTION = 'activitylogs_permanent';

function formatElapsed(startedAt) {
  const elapsedMs = Date.now() - startedAt;
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

async function flushBatch(target, batch, migrated) {
  if (batch.length === 0) return migrated;

  const result = await target.bulkWrite(
    batch.map((document) => ({
      updateOne: {
        filter: { _id: document._id },
        update: { $setOnInsert: document },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  return migrated + result.upsertedCount;
}

async function ensureTargetIndexes(target) {
  await target.createIndex({ organizationId: 1, timestamp: -1 });
  await target.createIndex({ timestamp: -1 });
  await target.createIndex({ entityType: 1, entityId: 1, timestamp: -1 });
  await target.createIndex({ actorId: 1, timestamp: -1 });
  await target.createIndex({ action: 1, timestamp: -1 });
}

async function main() {
  const startedAt = Date.now();
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const sourceCollections = await db
    .listCollections({ name: SOURCE_COLLECTION }, { nameOnly: true })
    .toArray();

  if (sourceCollections.length === 0) {
    console.log(`Source collection "${SOURCE_COLLECTION}" does not exist. Nothing to migrate.`);
    await mongoose.disconnect();
    return;
  }

  const source = db.collection(SOURCE_COLLECTION);

  const collections = await db
    .listCollections({ name: TARGET_COLLECTION }, { nameOnly: true })
    .toArray();

  if (collections.length === 0) {
    await db.createCollection(TARGET_COLLECTION);
  }

  const target = db.collection(TARGET_COLLECTION);
  await ensureTargetIndexes(target);

  const sourceCount = await source.countDocuments();
  const targetCountBefore = await target.countDocuments();
  console.log(`ActivityLog migration starting. Source: ${sourceCount}, target before: ${targetCountBefore}.`);

  let migrated = 0;
  let nextProgressAt = PROGRESS_INTERVAL;
  let batch = [];

  const cursor = source.find({}).batchSize(BATCH_SIZE);

  for await (const document of cursor) {
    batch.push(document);

    if (batch.length === BATCH_SIZE) {
      migrated = await flushBatch(target, batch, migrated);
      batch = [];

      while (migrated >= nextProgressAt) {
        console.log(`Migrated ${nextProgressAt} ActivityLog records...`);
        nextProgressAt += PROGRESS_INTERVAL;
      }
    }
  }

  migrated = await flushBatch(target, batch, migrated);

  while (migrated >= nextProgressAt) {
    console.log(`Migrated ${nextProgressAt} ActivityLog records...`);
    nextProgressAt += PROGRESS_INTERVAL;
  }

  const targetCountAfter = await target.countDocuments();
  console.log(`ActivityLog migration complete. Upserted ${migrated} records in ${formatElapsed(startedAt)}.`);
  console.log(`Target after: ${targetCountAfter}. Source remains: ${sourceCount}.`);
  console.log(`Old collection "${SOURCE_COLLECTION}" was not dropped. Keep it through the 2-week shadow period.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[ActivityLog migration] Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
