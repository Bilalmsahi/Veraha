/**
 * buildSeedFiles.js
 *
 * Converts notion_controls_raw.json (produced by fetchControlsFromNotion.js)
 * into the seed files that runSeeds.js consumes.  Safe to re-run at any time —
 * it only reads the raw file and rewrites the seed files; never calls Notion.
 *
 * Output files
 * ────────────
 *   data/frameworks.json
 *   data/requirementCategories.json
 *   data/requirements/soc2.json
 *   data/requirements/iso27001.json
 *   data/requirements/hipaa.json
 *   data/requirements/gdpr.json
 *   data/globalControlTemplates.json
 *   data/globalTestTemplates.json
 *
 * Usage
 * ─────
 *   npm run seed:build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR         = path.join(__dirname, '../data');
const RAW_FILE         = path.join(DATA_DIR, 'notion_controls_raw.json');
const REQUIREMENTS_DIR = path.join(DATA_DIR, 'requirements');

const FRAMEWORK_META = {
  SOC2:     { name: 'SOC 2 Type II',                       description: 'Service Organization Control 2 Type II',              version: '2017',  controlPrefix: 'SOC'  },
  ISO27001: { name: 'ISO/IEC 27001:2022',                  description: 'Information Security Management Systems',             version: '2022',  controlPrefix: 'ISO'  },
  HIPAA:    { name: 'HIPAA Security Rule',                  description: 'Health Insurance Portability and Accountability Act', version: '2013',  controlPrefix: 'HIP'  },
  GDPR:     { name: 'General Data Protection Regulation',   description: 'EU General Data Protection Regulation',              version: '2018',  controlPrefix: 'GDPR' },
};

const KNOWN_FW_CODES = Object.keys(FRAMEWORK_META);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1);
  console.log(`  ✓  ${path.relative(DATA_DIR, filePath).padEnd(52)} (${kb} KB)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────────

function build() {
  if (!fs.existsSync(RAW_FILE)) {
    console.error(`❌  Raw file not found:\n    ${RAW_FILE}`);
    console.error('\n    Run first:  npm run seed:fetch:controls');
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8'));
  } catch (err) {
    console.error(`❌  Failed to parse raw file: ${err.message}`);
    process.exit(1);
  }

  const rawControls = raw.controls || [];
  console.log(`\nℹ  Processing ${rawControls.length} raw controls from Notion…\n`);

  // ── 1. Frameworks ─────────────────────────────────────────────────────────
  const frameworkCodes = [
    // Preserve the declared order; fall back to whatever appears in the data
    ...KNOWN_FW_CODES.filter((c) => rawControls.some((ctrl) => ctrl.frameworkCode === c)),
    ...rawControls
      .map((c) => c.frameworkCode)
      .filter((c) => !KNOWN_FW_CODES.includes(c))
      .filter((v, i, a) => a.indexOf(v) === i),
  ];

  const frameworks = frameworkCodes.map((code) => {
    const meta = FRAMEWORK_META[code] || { name: code, description: '', version: '1.0', controlPrefix: code };
    return { code, name: meta.name, description: meta.description, version: meta.version };
  });

  // ── 2. Requirement categories ─────────────────────────────────────────────
  // Preserve insertion order (= depth-first Notion traversal order = page order).
  const catSeenKey  = (fw, code) => `${fw}::${code}`;
  const catMap      = new Map();
  const catCounters = {};

  for (const ctrl of rawControls) {
    const key = catSeenKey(ctrl.frameworkCode, ctrl.categoryCode);
    if (!catMap.has(key)) {
      catCounters[ctrl.frameworkCode] = (catCounters[ctrl.frameworkCode] || 0) + 1;
      catMap.set(key, {
        frameworkCode: ctrl.frameworkCode,
        code:          ctrl.categoryCode,
        title:         ctrl.categoryTitle,
        order:         catCounters[ctrl.frameworkCode],
      });
    }
  }

  const categories = [...catMap.values()];

  // ── 3. Requirements per framework ─────────────────────────────────────────
  const reqMaps = { soc2: new Map(), iso27001: new Map(), hipaa: new Map(), gdpr: new Map() };

  for (const ctrl of rawControls) {
    const fwKey = ctrl.frameworkCode.toLowerCase();
    if (!reqMaps[fwKey]) continue;

    for (const req of ctrl.requirements || []) {
      const reqKey = `${req.frameworkCode}::${req.identifier}`;
      if (!reqMaps[fwKey].has(reqKey)) {
        reqMaps[fwKey].set(reqKey, {
          frameworkCode: req.frameworkCode,
          categoryCode:  ctrl.categoryCode,
          identifier:    req.identifier,
          title:         req.title || req.identifier,
          description:   '',
        });
      }
    }
  }

  // ── 4. Global control templates ───────────────────────────────────────────
  // Assign sequential CTL-XXX-NNNN identifiers per framework in traversal order.
  const ctlCounters   = {};
  const ctlByNotionId = new Map(); // notionPageId → assigned CTL identifier

  const controlTemplates = rawControls.map((ctrl) => {
    const meta   = FRAMEWORK_META[ctrl.frameworkCode] || { controlPrefix: ctrl.frameworkCode };
    const prefix = meta.controlPrefix;
    ctlCounters[prefix] = (ctlCounters[prefix] || 0) + 1;
    const identifier    = `CTL-${prefix}-${String(ctlCounters[prefix]).padStart(4, '0')}`;

    ctlByNotionId.set(ctrl.notionPageId, identifier);

    return {
      identifier,
      title:                ctrl.title,
      description:          ctrl.description || '',
      controlGroup:         ctrl.controlGroup || ctrl.categoryTitle || '',
      suggestedPolicySlugs: ctrl.suggestedPolicySlugs || [],
      // Organisations start with every control in NOT_STARTED state
      defaultManualStatus:  'NOT_STARTED',
      frequency:            'QUARTERLY',
      implementationGuidance: '',
      suggestedRequirements: (ctrl.requirements || []).map((r) => ({
        frameworkCode: r.frameworkCode,
        identifier:    r.identifier,
        coverage:      r.coverage || 'FULL',
      })),
    };
  });

  // ── 5. Global test templates ──────────────────────────────────────────────
  // Deduplicate by normalised title across all frameworks.
  // When the same test appears under multiple controls, merge control links.
  const testByNorm = new Map(); // normTitle → test record
  const testList   = [];

  for (const ctrl of rawControls) {
    const ctlId = ctlByNotionId.get(ctrl.notionPageId);

    for (const test of ctrl.tests || []) {
      const norm = normalizeName(test.title);

      if (testByNorm.has(norm)) {
        const existing = testByNorm.get(norm);

        if (ctlId && !existing.suggestedControlIdentifiers.includes(ctlId)) {
          existing.suggestedControlIdentifiers.push(ctlId);
        }

        // Upgrade to automated if any instance is automated
        if (test.type === 'automated' && existing.type !== 'automated') {
          existing.type        = 'automated';
          existing.description = test.description || existing.description;
        }

        // Fill in missing guidance from later instances
        if (!existing.evidenceGuidance && test.evidenceGuidance) {
          existing.evidenceGuidance = test.evidenceGuidance;
        }
      } else {
        const record = {
          name:                      test.title,
          description:               test.description || test.title,
          evidenceGuidance:          test.evidenceGuidance || '',
          type:                      test.type,
          notionIcon:                test.notionIcon || null,
          category:                  test.category || 'Engineering',
          renewalPeriod:             'annually',
          suggestedControlIdentifiers: ctlId ? [ctlId] : [],
        };
        testByNorm.set(norm, record);
        testList.push(record);
      }
    }
  }

  // ── 6. Write all files ────────────────────────────────────────────────────
  ensureDir(DATA_DIR);
  ensureDir(REQUIREMENTS_DIR);

  console.log('Writing seed files:');
  writeJson(path.join(DATA_DIR, 'frameworks.json'),             frameworks);
  writeJson(path.join(DATA_DIR, 'requirementCategories.json'),  categories);
  writeJson(path.join(REQUIREMENTS_DIR, 'soc2.json'),           [...reqMaps.soc2.values()]);
  writeJson(path.join(REQUIREMENTS_DIR, 'iso27001.json'),       [...reqMaps.iso27001.values()]);
  writeJson(path.join(REQUIREMENTS_DIR, 'hipaa.json'),          [...reqMaps.hipaa.values()]);
  writeJson(path.join(REQUIREMENTS_DIR, 'gdpr.json'),           [...reqMaps.gdpr.values()]);
  writeJson(path.join(DATA_DIR, 'globalControlTemplates.json'), controlTemplates);
  writeJson(path.join(DATA_DIR, 'globalTestTemplates.json'),    testList);

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('Build Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Frameworks     : ${frameworks.length}`);
  console.log(`Categories     : ${categories.length}`);
  const totalReqs = Object.values(reqMaps).reduce((s, m) => s + m.size, 0);
  console.log(`Requirements   : ${totalReqs}`);
  console.log(`Controls       : ${controlTemplates.length}`);
  console.log(`Test templates : ${testList.length}`);
  console.log('───────────────────────────────────────');

  for (const code of frameworkCodes) {
    const fwCats  = categories.filter((c) => c.frameworkCode === code).length;
    const fwCtrls = controlTemplates.filter((c) =>
      c.suggestedRequirements.some((r) => r.frameworkCode === code)
    ).length;
    const fwTests = testList.filter((t) =>
      t.suggestedControlIdentifiers.some((id) => id.includes(`-${(FRAMEWORK_META[code]?.controlPrefix || code)}-`))
    ).length;
    console.log(`  ${code.padEnd(10)} : ${fwCats} categories, ${fwCtrls} controls, ${fwTests} test templates`);
  }

  console.log('═══════════════════════════════════════\n');
  console.log('▶   Next step: npm run seed:run');
}

try {
  build();
} catch (err) {
  console.error('❌  Build failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
