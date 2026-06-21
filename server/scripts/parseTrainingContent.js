/**
 * One-time utility: parse module*.md files into seed data under server/src/seeds/data/training/
 *
 * Usage: node server/scripts/parseTrainingContent.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'server/src/seeds/data/training');

const MODULES = [
  {
    file: 'module1_security_awareness.md',
    moduleKey: 'ISO_SOC2',
    title: 'Security Awareness Training: Protecting Our Organization',
    description:
      'Foundational security awareness aligned with SOC 2 Trust Service Criteria and ISO 27001:2022 — threats, passwords, data handling, and incident reporting.',
    frameworkTags: ['ISO27001', 'SOC2'],
    estimatedReadMinutes: 50,
    contentFile: 'iso-soc2.md',
    questionsFile: 'iso-soc2.questions.json',
  },
  {
    file: 'module2_hipaa.md',
    moduleKey: 'HIPAA',
    title: 'HIPAA Security & Privacy Awareness: Protecting Health Information',
    description:
      'HIPAA Privacy and Security Rules, PHI handling, minimum necessary, breaches, and workforce responsibilities.',
    frameworkTags: ['HIPAA'],
    estimatedReadMinutes: 50,
    contentFile: 'hipaa.md',
    questionsFile: 'hipaa.questions.json',
  },
  {
    file: 'module3_gdpr.md',
    moduleKey: 'GDPR',
    title: 'GDPR Data Protection Awareness: Your Guide to Responsible Data Handling',
    description:
      'GDPR principles, lawful processing, data subject rights, breaches, and privacy by design for everyday work.',
    frameworkTags: ['GDPR'],
    estimatedReadMinutes: 50,
    contentFile: 'gdpr.md',
    questionsFile: 'gdpr.questions.json',
  },
];

function parseModule(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const split = raw.split(/# MODULE \d+: QUESTION BANK/i);
  if (split.length < 2) {
    throw new Error(`Could not find QUESTION BANK section in ${filePath}`);
  }
  const contentMarkdown = split[0].trim();
  const jsonBlock = split[1].match(/```json\s*([\s\S]*?)```/);
  if (!jsonBlock) {
    throw new Error(`Could not find JSON question block in ${filePath}`);
  }
  const questionsRaw = JSON.parse(jsonBlock[1]);
  const questions = questionsRaw.map((q) => ({
    id: q.id,
    text: q.question,
    difficulty: q.difficulty,
    topic: q.topic,
    options: Object.entries(q.options).map(([id, text]) => ({
      id: id.toLowerCase(),
      text: String(text),
    })),
    correctOptionId: String(q.correctAnswer).toLowerCase(),
    explanation: q.explanation,
  }));
  return { contentMarkdown, questions };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = [];

  for (const mod of MODULES) {
    const srcPath = path.join(root, mod.file);
    const { contentMarkdown, questions } = parseModule(srcPath);

    fs.writeFileSync(path.join(outDir, mod.contentFile), contentMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(outDir, mod.questionsFile),
      JSON.stringify(questions, null, 2),
      'utf8'
    );

    manifest.push({
      moduleKey: mod.moduleKey,
      version: 1,
      title: mod.title,
      description: mod.description,
      frameworkTags: mod.frameworkTags,
      estimatedReadMinutes: mod.estimatedReadMinutes,
      contentFile: mod.contentFile,
      questionsFile: mod.questionsFile,
      quiz: {
        passingScore: 0.8,
        maxAttempts: 3,
        retryDelayHours: 24,
        questionsPerAttempt: 6,
      },
    });

    console.log(`✓ ${mod.moduleKey}: ${questions.length} questions, ${contentMarkdown.length} chars content`);
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log(`\nWrote manifest and files to ${outDir}`);
}

main();
