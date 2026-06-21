import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trainingDir = path.join(__dirname, 'training');

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(trainingDir, fileName), 'utf8'));
}

function loadMarkdown(fileName) {
  return fs.readFileSync(path.join(trainingDir, fileName), 'utf8');
}

const manifest = loadJson('manifest.json');

/**
 * Full training module seeds — content loaded from markdown files, questions from JSON.
 */
export const TRAINING_MODULE_SEEDS = manifest.map((entry) => ({
  moduleKey: entry.moduleKey,
  version: entry.version,
  title: entry.title,
  description: entry.description,
  frameworkTags: entry.frameworkTags,
  estimatedReadMinutes: entry.estimatedReadMinutes,
  contentMarkdown: loadMarkdown(entry.contentFile),
  contentHtml: '',
  quiz: {
    passingScore: entry.quiz.passingScore,
    maxAttempts: entry.quiz.maxAttempts,
    retryDelayHours: entry.quiz.retryDelayHours,
    questionsPerAttempt: entry.quiz.questionsPerAttempt,
    questions: loadJson(entry.questionsFile),
  },
}));

export default TRAINING_MODULE_SEEDS;
