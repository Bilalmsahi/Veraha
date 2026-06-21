import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { applyOrgScope } from '../lib/orgScope.js';

let mongo;
let ScopedModel;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const scopedSchema = new mongoose.Schema({
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  });

  scopedSchema.plugin(applyOrgScope, 'organizationId');
  ScopedModel = mongoose.model('OrgScopeTestDocument', scopedSchema);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

afterEach(async () => {
  await ScopedModel?.deleteMany({});
});

async function seedDocuments() {
  const orgA = new mongoose.Types.ObjectId();
  const orgB = new mongoose.Types.ObjectId();

  const [docA, docB] = await ScopedModel.create([
    { organizationId: orgA, name: 'org-a-doc' },
    { organizationId: orgB, name: 'org-b-doc' },
  ]);

  return { orgA, orgB, docA, docB };
}

describe('applyOrgScope', () => {
  test('a query without .forOrg() returns all documents', async () => {
    await seedDocuments();

    const documents = await ScopedModel.find().sort({ name: 1 });

    expect(documents).toHaveLength(2);
    expect(documents.map((document) => document.name)).toEqual(['org-a-doc', 'org-b-doc']);
  });

  test('a query with .forOrg(orgA) returns only orgA documents', async () => {
    const { orgA } = await seedDocuments();

    const documents = await ScopedModel.find().forOrg(orgA);

    expect(documents).toHaveLength(1);
    expect(documents[0].organizationId.equals(orgA)).toBe(true);
    expect(documents[0].name).toBe('org-a-doc');
  });

  test('a query with .forOrg(orgB) returns only orgB documents', async () => {
    const { orgB } = await seedDocuments();

    const documents = await ScopedModel.find().forOrg(orgB);

    expect(documents).toHaveLength(1);
    expect(documents[0].organizationId.equals(orgB)).toBe(true);
    expect(documents[0].name).toBe('org-b-doc');
  });

  test('.findById() with .forOrg() returns null for a document belonging to a different org', async () => {
    const { orgB, docA } = await seedDocuments();

    const document = await ScopedModel.findById(docA._id).forOrg(orgB);

    expect(document).toBeNull();
  });
});
