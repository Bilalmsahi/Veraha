import TrainingModule from '../models/TrainingModule.js';
import TRAINING_MODULE_SEEDS from './data/trainingModules.js';
import crypto from 'crypto';

function computeContentHash(moduleSeed) {
  const hashSource = JSON.stringify({
    contentMarkdown: moduleSeed.contentMarkdown || '',
    contentHtml: moduleSeed.contentHtml || '',
    quiz: moduleSeed.quiz || {},
  });
  return crypto.createHash('sha256').update(hashSource).digest('hex');
}

export async function seedTrainingModulesForOrganization(organizationId) {
  let created = 0;
  let skipped = 0;

  for (let moduleSeed of TRAINING_MODULE_SEEDS) {
    const contentHash = computeContentHash(moduleSeed);
    const existing = await TrainingModule.findOne({
      organizationId,
      moduleKey: moduleSeed.moduleKey,
      version: moduleSeed.version,
    });

    if (existing) {
      if (existing.contentHash === contentHash) {
        skipped += 1;
        continue;
      }
      const latest = await TrainingModule.findOne({
        organizationId,
        moduleKey: moduleSeed.moduleKey,
      })
        .sort({ version: -1 })
        .select('version')
        .lean();
      moduleSeed = {
        ...moduleSeed,
        version: Number(latest?.version || moduleSeed.version) + 1,
      };
    }

    await TrainingModule.updateMany(
      { organizationId, moduleKey: moduleSeed.moduleKey },
      { $set: { active: false } }
    );

    await TrainingModule.create({
      organizationId,
      ...moduleSeed,
      contentHash,
      active: true,
    });
    created += 1;
  }

  return { created, skipped, total: TRAINING_MODULE_SEEDS.length };
}

export default seedTrainingModulesForOrganization;
