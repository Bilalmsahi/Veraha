/**
 * Seeding Verification Script
 * Checks that global and demo data were seeded correctly
 *
 * Usage: node src/seeds/verifySeeding.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verify() {
  console.log('\n🔍 Verifying database seeding...\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const results = { global: {}, demo: {} };

  // Global data
  results.global.frameworks = await mongoose.connection.db.collection('frameworks').countDocuments();
  results.global.requirements = await mongoose.connection.db.collection('requirements').countDocuments();
  results.global.globalControlTemplates = await mongoose.connection.db.collection('globalcontroltemplates').countDocuments();
  results.global.policyTemplates = await mongoose.connection.db.collection('policytemplates').countDocuments();

  // Check PolicyTemplates have fileKey (uploaded to storage)
  const policyTemplatesWithFile = await mongoose.connection.db
    .collection('policytemplates')
    .countDocuments({ fileKey: { $exists: true, $ne: null, $ne: '' } });

  // Demo tenant
  const demoOrg = await mongoose.connection.db.collection('organizations').findOne({
    domain: 'demo.proto.cx',
  });
  if (demoOrg) {
    const orgId = demoOrg._id;
    results.demo.organization = demoOrg.name;
    results.demo.users = await mongoose.connection.db.collection('users').countDocuments({ organizationId: orgId });
    results.demo.controls = await mongoose.connection.db.collection('internalcontrols').countDocuments({ organizationId: orgId });
    results.demo.policies = await mongoose.connection.db.collection('policies').countDocuments({ organizationId: orgId, isDeleted: false });
    results.demo.risks = await mongoose.connection.db.collection('risks').countDocuments({ organizationId: orgId });
    results.demo.vendors = await mongoose.connection.db.collection('vendors').countDocuments({ organizationId: orgId });
  }

  // Output
  console.log('📊 GLOBAL DATA');
  console.log('   Frameworks:', results.global.frameworks);
  console.log('   Requirements:', results.global.requirements);
  console.log('   Global Control Templates:', results.global.globalControlTemplates);
  console.log('   Policy Templates:', results.global.policyTemplates, `(${policyTemplatesWithFile} with fileKey)`);
  console.log('');

  if (results.demo.organization) {
    console.log('📊 DEMO TENANT:', results.demo.organization);
    console.log('   Users:', results.demo.users);
    console.log('   Internal Controls:', results.demo.controls);
    console.log('   Policies:', results.demo.policies);
    console.log('   Risks:', results.demo.risks);
    console.log('   Vendors:', results.demo.vendors);
  } else {
    console.log('⚠️  Demo organization not found. Run: npm run seed:demo:fresh');
  }

  const ok =
    results.global.frameworks >= 4 &&
    results.global.policyTemplates >= 32 &&
    (!demoOrg || results.demo.policies >= 20);

  console.log('\n' + (ok ? '✅ Seeding verification passed' : '⚠️  Some counts may be low') + '\n');
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

verify().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
