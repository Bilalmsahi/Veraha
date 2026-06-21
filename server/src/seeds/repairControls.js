/**
 * Repair stale linkedRequirements on all controls across all organizations.
 * Run this after `npm run seed:fresh` if tenant controls already exist.
 *
 * Usage:
 *   npm run seed:repair
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import '../models/index.js';
import Organization from '../models/Organization.js';
import InternalControl from '../models/InternalControl.js';
import organizationService from '../services/organizationService.js';

async function run() {
  console.log('🔧 Repairing control linkedRequirements...\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const orgs = await Organization.find({}).lean();
  let totalRepaired = 0;

  for (const org of orgs) {
    const count = await InternalControl.countDocuments({ organizationId: org._id, isDeleted: false });
    if (count === 0) continue;

    const repaired = await organizationService.repairControlRequirements(org._id);
    if (repaired > 0) {
      console.log(`  ✅ ${org.name}: repaired ${repaired}/${count} controls`);
    }
    totalRepaired += repaired;
  }

  console.log(`\n✅ Done. Total repaired: ${totalRepaired}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Repair failed:', err);
  process.exit(1);
});
