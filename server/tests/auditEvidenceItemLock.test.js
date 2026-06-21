import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import AuditEvidenceItem from '../src/models/AuditEvidenceItem.js';

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

afterEach(async () => {
  await AuditEvidenceItem.deleteMany({}).setOptions({ includeDeleted: true });
});

async function createLockedEvidenceItem() {
  return AuditEvidenceItem.create({
    organizationId: new mongoose.Types.ObjectId(),
    auditId: new mongoose.Types.ObjectId(),
    controlId: new mongoose.Types.ObjectId(),
    title: 'Locked evidence',
    fileUrl: 'https://example.com/original.pdf',
    status: 'READY_FOR_AUDIT',
    lockedAt: new Date(),
  });
}

describe('AuditEvidenceItem locking', () => {
  test('updating status succeeds on a locked evidence item', async () => {
    const item = await createLockedEvidenceItem();

    item.status = 'APPROVED';
    await expect(item.save()).resolves.toMatchObject({ status: 'APPROVED' });
  });

  test('updating fileUrl throws the lock error on a locked evidence item', async () => {
    const item = await createLockedEvidenceItem();

    item.fileUrl = 'https://example.com/changed.pdf';
    await expect(item.save()).rejects.toThrow('Evidence item is locked and cannot be modified');
  });
});
