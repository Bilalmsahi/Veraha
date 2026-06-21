/**
 * Policy Transformer
 * Reads Vanta-Policy-Templates folder + policies.json → policyLibrary.json
 * Uses policies.json metadata (title, description, frameworks, category) to enrich templates.
 *
 * Usage: npm run seed:transform:policies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '../raw/Vanta-Policy-Templates');
const POLICIES_JSON = path.join(__dirname, '../demo/policies.json');
const OUTPUT_LIBRARY = path.join(__dirname, '../data/policyLibrary.json');

const EXTENSIONS = ['.docx', '.xlsx'];

function filenameToSlug(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base;
}

async function transformPolicies() {
  console.log('🔄 Transforming Policy Templates...\n');

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error('❌ Vanta-Policy-Templates folder not found at:', TEMPLATES_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return EXTENSIONS.includes(ext);
  });

  console.log(`📊 Found ${files.length} template files\n`);

  let policiesMeta = [];
  if (fs.existsSync(POLICIES_JSON)) {
    policiesMeta = JSON.parse(fs.readFileSync(POLICIES_JSON, 'utf-8'));
  }
  const byFilename = new Map(policiesMeta.map((p) => [p.filename, p]));

  const templates = [];
  for (const filename of files.sort()) {
    const meta = byFilename.get(filename) || {};
    const slug = filenameToSlug(filename);

    templates.push({
      slug,
      title: meta.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: meta.description || '',
      filename,
      frameworkCodes: meta.frameworks || [],
      category: meta.category || 'General',
      source: 'VANTA',
    });
  }

  const outputDir = path.dirname(OUTPUT_LIBRARY);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_LIBRARY, JSON.stringify(templates, null, 2), 'utf-8');
  console.log(`✅ Wrote ${templates.length} templates to ${OUTPUT_LIBRARY}\n`);
}

transformPolicies().catch((err) => {
  console.error(err);
  process.exit(1);
});
