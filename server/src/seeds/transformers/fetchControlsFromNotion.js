/**
 * fetchControlsFromNotion.js
 *
 * Crawls the Notion Frameworks tree depth-first and builds a complete
 * "notion_controls_raw.json" with the full chain embedded in each record:
 *
 *   Framework → Category → Requirement → Control + all Tests/Docs
 *
 * Key guarantees
 * ──────────────
 *  Resume      – saves after every control; a crash loses at most 1 control.
 *  Dedup       – a control page that appears under multiple requirements gets
 *                ONE record; subsequent appearances only add the new req link.
 *  No regex transform – hierarchy is structural, not parsed from body text.
 *  All ISO27001 categories – handles both C.x (clauses) and A.x (annexes).
 *
 * Usage
 * ─────
 *   npm run seed:fetch:controls            # resume from last save (default)
 *   npm run seed:fetch:controls -- --reset # ignore saved progress, start fresh
 *
 * Required env vars  (server/.env)
 *   NOTION_TOKEN                  ntn_… or secret_…
 *   NOTION_FRAMEWORKS_PAGE_ID     page ID of the top-level Frameworks page
 */

import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const NOTION_TOKEN          = process.env.NOTION_TOKEN;
const FRAMEWORKS_PAGE_ID    = process.env.NOTION_FRAMEWORKS_PAGE_ID;

const DATA_DIR      = path.join(__dirname, '../data');
const OUTPUT_FILE   = path.join(DATA_DIR, 'notion_controls_raw.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'notion_fetch_progress.json');

/** Notion allows 3 req/s; 350 ms keeps us safely under the limit. */
const DELAY_MS = 350;

const RESET = process.argv.includes('--reset');

const FRAMEWORKS = {
  GDPR:     { code: 'GDPR',     name: 'General Data Protection Regulation', controlPrefix: 'GDPR' },
  HIPAA:    { code: 'HIPAA',    name: 'HIPAA Security Rule',                 controlPrefix: 'HIP'  },
  SOC2:     { code: 'SOC2',     name: 'SOC 2 Type II',                       controlPrefix: 'SOC'  },
  ISO27001: { code: 'ISO27001', name: 'ISO/IEC 27001:2022',                  controlPrefix: 'ISO'  },
};

/**
 * When a test-page title matches one of these keys (lowercased), the test is
 * classified as "automated" (a policy-check) and the slug is stored on the
 * parent control for later linking.
 */
const POLICY_CHECK_TO_SLUG = {
  'company has an approved code of conduct':                     'code-of-conduct-bsi',
  'company has an approved information security policy (aup)':   'information-security-policy-bsi',
  'company has an approved operations security policy':          'operations-security-policy-bsi',
  'company has an approved incident response plan':              'incident-response-plan-bsi',
  'company has an approved risk management policy':              'risk-management-policy-bsi',
  'company has an approved asset management policy':             'asset-management-policy-bsi',
  'company has an approved data management policy':              'data-management-policy-bsi',
  'company has an approved human resource security policy':      'human-resource-security-policy-bsi',
  'company has an approved physical security policy':            'physical-security-policy-bsi',
  'company has an approved third-party management policy':       'third-party-management-policy-bsi',
  'company has an approved cryptography policy':                 'cryptography-policy-bsi',
  'company has an approved secure development policy':           'secure-development-policy-bsi',
  'company has an approved business continuity and disaster recovery plan':
    'business-continuity-and-disaster-recovery-plan-bsi',
  'company has an approved gdpr compliance policy':              'gdpr-compliance-policy',
  'company has an approved hipaa compliance policy':             'hipaa-compliance-policy-bsi',
  'company has an approved hipaa workstation security policy':   'hipaa-workstation-security-policy-bsi',
  'company has an approved incident response plan hipaa addendum with breach notification procedures':
    'incident-response-plan-hipaa-addendum-with-breach-notification-procedures-bsi',
  'personnel agree to information security policy':              'information-security-policy-bsi',
  'personnel agree to code of conduct':                          'code-of-conduct-bsi',
  'personnel agree to operations security policy':               'operations-security-policy-bsi',
  'personnel agree to incident response plan':                   'incident-response-plan-bsi',
  'personnel agree to human resource security policy':           'human-resource-security-policy-bsi',
  'personnel agree to physical security policy':                 'physical-security-policy-bsi',
  'personnel agree to asset management policy':                  'asset-management-policy-bsi',
  'personnel agree to data management policy':                   'data-management-policy-bsi',
  'personnel agree to secure development policy':                'secure-development-policy-bsi',
  'personnel agree to access control policy':                    'access-control-policy-bsi',
  'personnel agree to information security roles and responsibilities':
    'information-security-roles-and-responsibilities-bsi',
  'personnel agree to hipaa compliance policy':                  'hipaa-compliance-policy-bsi',
  'personnel agree to incident response plan hipaa addendum with breach notification procedures':
    'incident-response-plan-hipaa-addendum-with-breach-notification-procedures-bsi',
};

// ─────────────────────────────────────────────────────────────────────────────
// ICON CLASSIFICATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notion page icons that definitively mark a test as AUTOMATED (policy check).
 * 🚩 is the red-flag emoji Notion uses to mark automated/policy-check tests.
 */
const AUTOMATED_ICONS = new Set(['🚩']);

/**
 * Notion page icons that definitively mark a test as a DOCUMENT / evidence item.
 * These are the clipboard/document emojis Notion uses for manual evidence.
 */
const DOCUMENT_ICONS = new Set([
  '📋', // clipboard  — used for tabletop exercises, manual evidence, etc.
  '📜', // scroll     — policy/document artefact
  '📄', // page       — document evidence
  '📝', // memo       — written evidence
  '📃', // page curl  — document variant
  '📑', // bookmark tabs — structured document
  '🗂️', // card index dividers
  '📁', // folder
  '📂', // open folder
  '📊', // bar chart  — report/metric evidence
  '🗄️', // file cabinet
  '🖹',  // document (less common)
]);

// ─────────────────────────────────────────────────────────────────────────────
// TEXT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const NOTION_UI_ARTIFACTS = /(fa-[a-z-]+\s+alpaca-fa-[a-z-]+)/gi;
const FILE_EXT_PATTERN    = /\.(pdf|docx|xlsx|csv|png|jpg|jpeg|gif|txt)$/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (!value) return '';
  return String(value)
    .replace(NOTION_UI_ARTIFACTS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return cleanText(value).toLowerCase();
}

function richTextToPlain(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((t) => t.plain_text ?? '').join('');
}

function extractBlockText(block) {
  const type = block.type;
  const data = block[type];
  if (!data) return '';
  const richTypes = [
    'paragraph', 'heading_1', 'heading_2', 'heading_3',
    'bulleted_list_item', 'numbered_list_item',
    'toggle', 'quote', 'callout', 'code',
  ];
  if (richTypes.includes(type) && data.rich_text) {
    return richTextToPlain(data.rich_text);
  }
  return '';
}

/**
 * If a title is > 100 chars, split at a natural guidance break-point.
 * Returns { title, guidance }.
 */
function extractShortTitleAndGuidance(name) {
  const cleaned = cleanText(name);
  if (!cleaned) return { title: '', guidance: '' };
  if (cleaned.length <= 100) return { title: cleaned, guidance: '' };
  const re = /\s+(Provide\b|Acceptable evidence\b|Guidance:|Evidence of\b|Must include\b|Must be\b|This test\b|Please\b)/i;
  const m  = cleaned.match(re);
  if (!m || typeof m.index !== 'number' || m.index <= 20) {
    return { title: cleaned, guidance: '' };
  }
  return {
    title:    cleanText(cleaned.slice(0, m.index)),
    guidance: cleanText(cleaned.slice(m.index)),
  };
}

function inferTestCategory(controlGroup, testName) {
  const src = `${controlGroup || ''} ${testName || ''}`.toLowerCase();
  if (/(policy|code of conduct|privacy|hipaa|gdpr|isms)/.test(src))    return 'Policy';
  if (/(personnel|employee|contractor|hr|human resource)/.test(src))   return 'Human resources';
  if (/(risk|threat)/.test(src))                                        return 'Risks';
  if (/(legal|agreement|contract|dpa|msa)/.test(src))                  return 'Legal';
  if (/(finance|billing|invoice|tax)/.test(src))                       return 'Finance';
  if (/(board|management|oversight)/.test(src))                        return 'Management';
  return 'Engineering';
}

/**
 * Classify a test/doc page as "automated" or "document".
 * Returns { type, evidenceGuidance, suggestedPolicySlug }
 */
function inferTestType(pageTitle, bodyText) {
  const norm       = normalizeName(pageTitle);
  const policySlug = POLICY_CHECK_TO_SLUG[norm] || null;

  if (policySlug) {
    return { type: 'automated', evidenceGuidance: '', suggestedPolicySlug: policySlug };
  }

  const body = cleanText(bodyText);

  // Body-text heuristics for automated checks
  if (body && /^(this .{0,25}verif|verif(ies|y)\b|vanta (verif|checks)|the system (verif|checks))/i.test(body)) {
    return { type: 'automated', evidenceGuidance: '', suggestedPolicySlug: null };
  }

  // Body-text heuristics for document evidence requests
  if (body && /^(provide|upload|submit|attach)\b/i.test(body)) {
    return { type: 'document', evidenceGuidance: body, suggestedPolicySlug: null };
  }

  // Default: requires a human to upload evidence
  return { type: 'document', evidenceGuidance: body, suggestedPolicySlug: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// HIERARCHY PARSERS
// (Operate on page titles — no emoji-marker parsing needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a category code and title from a category-level page title.
 * Returns { code, title } or null if the page is not a recognisable category.
 */
function parseCategoryFromTitle(frameworkCode, pageTitle) {
  const text = cleanText(pageTitle);
  if (!text) return null;

  if (frameworkCode === 'SOC2') {
    if (/^SD\b/i.test(text)) return null;
    const m = text.match(/^([A-Z]+)\s+(\d+)(?:\.0)?\s*(.*)$/);
    if (!m) return null;
    return { code: `${m[1]}${m[2]}`, title: cleanText(m[3]) || text };
  }

  if (frameworkCode === 'ISO27001') {
    // A.x  Annex controls  (A.5 – A.8)
    const a = text.match(/^(A)\.(\d+)\s*(.*)$/i);
    if (a) return { code: `A${a[2]}`, title: cleanText(a[3]) || text };
    // C.x  Clause sections (C.4 – C.10)
    const c = text.match(/^(C)\.(\d+)\s*(.*)$/i);
    if (c) return { code: `C${c[2]}`, title: cleanText(c[3]) || text };
    return null;
  }

  if (frameworkCode === 'HIPAA') {
    const m = text.match(/^164\.(\d{3})\s*(.*)$/);
    if (!m) return null;
    return { code: `HIP${m[1]}`, title: cleanText(m[2]) || text };
  }

  if (frameworkCode === 'GDPR') {
    const ch = text.match(/^Chapter\s+(\d+)\s*(.*)$/i);
    if (ch) {
      const braces = ch[2].match(/\{([^}]+)\}/);
      return { code: `GDPR_CH${ch[1]}`, title: cleanText(braces ? braces[1] : ch[2]) || text };
    }
    const dpf = text.match(/^EU-US-DPF\s*(.*)$/i);
    if (dpf) return { code: 'GDPR_DPF', title: cleanText(dpf[1]) || 'EU US Data Privacy Framework' };
    return null;
  }

  return null;
}

/**
 * Parse a requirement identifier and title from a requirement-level page title.
 * Returns { identifier, title } or null if the page doesn't match.
 */
function parseRequirementFromTitle(frameworkCode, pageTitle) {
  const text = cleanText(pageTitle);
  if (!text) return null;

  if (frameworkCode === 'SOC2') {
    const m = text.match(/^([A-Z]+\s+\d+(?:\.\d+)?)\s*(.*)$/);
    if (m) return { identifier: cleanText(m[1]), title: cleanText(m[2]) || cleanText(m[1]) };
    return null;
  }

  if (frameworkCode === 'ISO27001') {
    // Handles A.5.1, C.4.1, A.8.34 etc.
    const m = text.match(/^([AC]\.\d+\.\d+(?:\.\d+)?)\s*(.*)$/i);
    if (m) return { identifier: m[1].toUpperCase(), title: cleanText(m[2]) || m[1] };
    return null;
  }

  if (frameworkCode === 'HIPAA') {
    const m = text.match(/^(\d{3}\.\d{3}[^\s]*)\s*(.*)$/);
    if (m) return { identifier: cleanText(m[1]), title: cleanText(m[2]) || cleanText(m[1]) };
    return null;
  }

  if (frameworkCode === 'GDPR') {
    const art = text.match(/^(Article\s+\d+)\s*(.*)$/i);
    if (art) {
      const braces = art[2].match(/\{([^}]+)\}/);
      return {
        identifier: cleanText(art[1]),
        title:      cleanText(braces ? braces[1] : art[2]) || cleanText(art[1]),
      };
    }
    const dpf = text.match(/^(EU-USDPF-[A-Z]+)\s*(.*)$/i);
    if (dpf) return { identifier: cleanText(dpf[1]), title: cleanText(dpf[2]) || cleanText(dpf[1]) };
    return null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTION API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const notion = new Client({ auth: NOTION_TOKEN });
let apiCallCount = 0;

/**
 * Fetch ALL blocks of a page in one logical call (handles Notion pagination).
 * Returns { bodyText: string, childPages: [{id, title}] }
 *
 * Using a single `blocks.children.list` traversal avoids the need for two
 * separate calls (one for body text, one for child pages).
 */
async function getPageContent(pageId) {
  const lines      = [];
  const childPages = [];
  let cursor;

  do {
    await sleep(DELAY_MS);
    apiCallCount++;

    let res;
    try {
      res = await notion.blocks.children.list({
        block_id:     pageId,
        page_size:    100,
        start_cursor: cursor,
      });
    } catch (err) {
      console.error(`  ⚠  API error for page ${pageId}: ${err.message}`);
      break;
    }

    for (const block of res.results) {
      if (block.type === 'child_page') {
        childPages.push({ id: block.id, title: block.child_page.title ?? 'Untitled' });
      } else {
        const text = extractBlockText(block);
        if (text.trim()) lines.push(text);
      }
    }

    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return { bodyText: lines.join(' ').trim(), childPages };
}

/**
 * Fetch the emoji icon set on a Notion page (e.g. 🚩, 📋, ⚙️).
 * Returns the emoji string, or null if the page has no emoji icon.
 *
 * This is the most reliable signal for test/doc type classification because
 * content authors explicitly chose these icons to label item types.
 */
async function getPageIcon(pageId) {
  await sleep(DELAY_MS);
  apiCallCount++;
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const icon = page?.icon;
    if (icon?.type === 'emoji') return icon.emoji;
    return null;
  } catch (err) {
    // Non-fatal: fall back to body-text heuristics
    console.warn(`  ⚠  Could not fetch icon for ${pageId}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS + OUTPUT STATE
// ─────────────────────────────────────────────────────────────────────────────

let progress = {
  startedAt:              null,
  lastUpdatedAt:          null,
  visitedControlPageIds:  [],   // serialised as array; read back as Set
  completedFrameworks:    [],   // frameworks fully walked; skipped on resume
  stats:                  {},
};

let visitedSet      = new Set();
let outputData      = { meta: {}, controls: [] };
let controlByPageId = new Map();   // notionPageId → control record (for cross-ref merges)

function loadState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!RESET && fs.existsSync(PROGRESS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      progress    = { ...progress, ...saved };
      visitedSet  = new Set(progress.visitedControlPageIds);
      console.log(`▶  Resuming — ${visitedSet.size} controls already saved.`);
    } catch {
      console.warn('⚠  Could not read progress file — starting fresh.');
    }
  }

  if (!RESET && fs.existsSync(OUTPUT_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      outputData  = saved;
      for (const ctrl of outputData.controls || []) {
        controlByPageId.set(ctrl.notionPageId, ctrl);
      }
      console.log(`▶  Loaded ${outputData.controls.length} existing controls.`);
    } catch {
      console.warn('⚠  Could not read output file — starting with empty list.');
      outputData = { meta: {}, controls: [] };
    }
  }

  if (!progress.startedAt) progress.startedAt = new Date().toISOString();
}

/**
 * Atomic JSON write: write to a .tmp file then rename over the target.
 * On Windows, direct overwrite of a large open file can fail with
 * "UNKNOWN: unknown error" — the write-then-rename pattern avoids this
 * because the OS only swaps the directory entry once the write is complete.
 */
function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    // rename can fail if target is locked; fall back to a plain copy + delete
    fs.copyFileSync(tmp, filePath);
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function saveState() {
  progress.lastUpdatedAt            = new Date().toISOString();
  progress.visitedControlPageIds    = [...visitedSet];

  outputData.meta = {
    fetchedAt:     new Date().toISOString(),
    totalControls: outputData.controls.length,
    totalTests:    outputData.controls.reduce((s, c) => s + (c.tests?.length ?? 0), 0),
    frameworks:    Object.keys(FRAMEWORKS),
    apiCalls:      apiCallCount,
  };

  writeJsonAtomic(PROGRESS_FILE, progress);
  writeJsonAtomic(OUTPUT_FILE,   outputData);
}

// ─────────────────────────────────────────────────────────────────────────────
// HIERARCHY WALKERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and classify all test/doc child pages of a control page.
 *
 * Classification priority (strongest first):
 *   1. Notion page icon  — 🚩 = automated, 📋/📜/📄/… = document
 *   2. POLICY_CHECK_TO_SLUG title map
 *   3. Body-text heuristics  ("Verifies…" = automated, "Provide…" = document)
 *   4. Default: document
 *
 * Returns { tests: TestRecord[], suggestedPolicySlugs: string[] }
 */
async function fetchTestsForControl(controlPageId, controlGroup, indent) {
  const { childPages } = await getPageContent(controlPageId);

  const tests               = [];
  const suggestedPolicySlugs = [];

  for (const testPage of childPages) {
    if (FILE_EXT_PATTERN.test(testPage.title)) continue;

    // Fetch body text and page icon in sequence (respects rate limit)
    const { bodyText } = await getPageContent(testPage.id);
    const iconEmoji    = await getPageIcon(testPage.id);

    const { title: shortTitle, guidance: extractedGuidance } =
      extractShortTitleAndGuidance(cleanText(testPage.title));

    // Layer 1: body-text heuristics + POLICY_CHECK_TO_SLUG
    const { type: inferredType, evidenceGuidance, suggestedPolicySlug } =
      inferTestType(testPage.title, bodyText);

    // Layer 2: Notion page icon — overrides the inferred type when unambiguous.
    // Content authors explicitly set these icons, making them the strongest signal.
    let finalType = inferredType;
    if (AUTOMATED_ICONS.has(iconEmoji)) {
      finalType = 'automated';
    } else if (DOCUMENT_ICONS.has(iconEmoji)) {
      finalType = 'document';
    }

    const iconLabel = iconEmoji ? ` ${iconEmoji}` : '';
    process.stdout.write(`${indent}  ${finalType === 'automated' ? '🚩' : '📋'}${iconLabel} ${testPage.title}\n`);

    const effectiveGuidance = evidenceGuidance || extractedGuidance || '';

    tests.push({
      notionPageId:     testPage.id,
      title:            shortTitle || cleanText(testPage.title),
      type:             finalType,
      notionIcon:       iconEmoji || null,
      description:      finalType === 'automated'
                          ? (bodyText || shortTitle || '')
                          : (shortTitle || cleanText(testPage.title)),
      evidenceGuidance: finalType === 'document' ? effectiveGuidance : '',
      category:         inferTestCategory(controlGroup, shortTitle || testPage.title),
      suggestedPolicySlug: suggestedPolicySlug || null,
    });

    if (suggestedPolicySlug && !suggestedPolicySlugs.includes(suggestedPolicySlug)) {
      suggestedPolicySlugs.push(suggestedPolicySlug);
    }
  }

  return { tests, suggestedPolicySlugs };
}

/**
 * Process a single control page.
 *
 * Cross-reference path  → already visited: just merge the new requirement link.
 * First-time path       → fetch body, fetch tests, build record, save.
 */
async function processControl(controlPage, frameworkMeta, categoryMeta, reqMeta, depth) {
  const indent    = '  '.repeat(depth);
  const pageId    = controlPage.id;
  const pageTitle = cleanText(controlPage.title);

  if (FILE_EXT_PATTERN.test(pageTitle)) return;

  const reqLink = {
    frameworkCode: frameworkMeta.code,
    identifier:    reqMeta.identifier,
    title:         reqMeta.title,
    coverage:      'FULL',
  };

  // ── Cross-reference: control already visited ──────────────────────────────
  if (visitedSet.has(pageId)) {
    const existing = controlByPageId.get(pageId);
    if (existing) {
      const key     = `${reqLink.frameworkCode}:${reqLink.identifier}`;
      const already = existing.requirements.some((r) => `${r.frameworkCode}:${r.identifier}` === key);
      if (!already) {
        existing.requirements.push(reqLink);
        process.stdout.write(`${indent}↩  Cross-ref: "${pageTitle}" → +req ${reqLink.identifier}\n`);
        saveState();
      }
    }
    return;
  }

  // ── First time: fetch content and build the record ────────────────────────
  process.stdout.write(`${indent}⚙️  ${pageTitle}\n`);

  // Single API call returns both body text and child page list
  const { bodyText } = await getPageContent(pageId);

  // Strip trailing "Tests: / Documents:" label that some pages include
  const description = cleanText(bodyText)
    .replace(/\s*(tests?|documents?|evidence|policies):\s*[\s\S]*/i, '')
    .trim();

  const { title: shortTitle } = extractShortTitleAndGuidance(pageTitle);

  const { tests, suggestedPolicySlugs } =
    await fetchTestsForControl(pageId, categoryMeta.title, indent);

  const controlRecord = {
    notionPageId:       pageId,
    frameworkCode:      frameworkMeta.code,
    categoryCode:       categoryMeta.code,
    categoryTitle:      categoryMeta.title,
    requirements:       [reqLink],
    title:              shortTitle || pageTitle,
    description,
    controlGroup:       categoryMeta.title,
    suggestedPolicySlugs,
    tests,
  };

  outputData.controls.push(controlRecord);
  controlByPageId.set(pageId, controlRecord);
  visitedSet.add(pageId);

  if (!progress.stats[frameworkMeta.code]) {
    progress.stats[frameworkMeta.code] = { controls: 0, tests: 0, documents: 0 };
  }
  const s = progress.stats[frameworkMeta.code];
  s.controls  += 1;
  s.tests     += tests.filter((t) => t.type === 'automated').length;
  s.documents += tests.filter((t) => t.type === 'document').length;

  saveState();
}

/**
 * Walk a requirement page.
 * All its children are treated as controls (strict 4-level hierarchy).
 * If there are no children, log as empty and skip.
 */
async function walkRequirement(reqPage, frameworkMeta, categoryMeta, reqMeta, depth) {
  const indent = '  '.repeat(depth);
  process.stdout.write(`${indent}📖 ${reqMeta.identifier}: ${reqMeta.title}\n`);

  const { childPages } = await getPageContent(reqPage.id);

  if (childPages.length === 0) {
    process.stdout.write(`${indent}  (empty requirement — no controls defined)\n`);
    return;
  }

  for (const controlPage of childPages) {
    await processControl(controlPage, frameworkMeta, categoryMeta, reqMeta, depth + 1);
  }
}

/**
 * Walk a category page.
 * Children are treated as requirements if their title parses as one;
 * otherwise they are treated as direct controls (Bug-5 / catch-all path).
 */
async function walkCategory(categoryPage, frameworkMeta, categoryMeta, depth) {
  const indent = '  '.repeat(depth);
  process.stdout.write(`${indent}📕 ${categoryMeta.code}: ${categoryMeta.title}\n`);

  const { childPages } = await getPageContent(categoryPage.id);

  // Synthetic requirement used when a category child doesn't parse as a requirement
  const syntheticReq = { identifier: `${categoryMeta.code}_GEN`, title: categoryMeta.title };
  let syntheticUsed  = false;

  for (const reqPage of childPages) {
    const pageTitle = cleanText(reqPage.title);
    if (FILE_EXT_PATTERN.test(pageTitle)) continue;

    const reqMeta = parseRequirementFromTitle(frameworkMeta.code, pageTitle);

    if (!reqMeta) {
      // Title doesn't parse as a requirement identifier → treat as direct control
      if (!syntheticUsed) {
        process.stdout.write(`${indent}  📖 ${syntheticReq.identifier} (synthetic — direct controls)\n`);
        syntheticUsed = true;
      }
      await processControl(reqPage, frameworkMeta, categoryMeta, syntheticReq, depth + 2);
      continue;
    }

    await walkRequirement(reqPage, frameworkMeta, categoryMeta, reqMeta, depth + 1);
  }
}

/**
 * Walk the bridge node (the "CONTROLS" page under a framework) as categories.
 */
async function walkBridge(bridgePage, frameworkMeta, depth) {
  const indent = '  '.repeat(depth);
  process.stdout.write(`${indent}🌉 ${bridgePage.title}\n`);

  const { childPages } = await getPageContent(bridgePage.id);

  for (const categoryPage of childPages) {
    const pageTitle = cleanText(categoryPage.title);
    if (FILE_EXT_PATTERN.test(pageTitle)) continue;

    const categoryMeta = parseCategoryFromTitle(frameworkMeta.code, pageTitle);
    if (!categoryMeta) {
      process.stdout.write(`${indent}  ⏭  Skipping unrecognised category page: "${pageTitle}"\n`);
      continue;
    }

    await walkCategory(categoryPage, frameworkMeta, categoryMeta, depth + 1);
  }
}

/**
 * Walk a framework page: find the CONTROLS bridge, then walk categories.
 * On resume: if this framework is already in completedFrameworks, skip it
 * entirely — no API calls needed, all controls are already saved.
 */
async function walkFramework(frameworkPageId, frameworkMeta, depth) {
  process.stdout.write(`\n${'═'.repeat(64)}\n`);
  process.stdout.write(`Framework: ${frameworkMeta.code}  —  ${frameworkMeta.name}\n`);
  process.stdout.write(`${'═'.repeat(64)}\n`);

  // Fast-skip: entire framework already processed in a previous run
  if (progress.completedFrameworks.includes(frameworkMeta.code)) {
    const n = progress.stats[frameworkMeta.code]?.controls ?? '?';
    process.stdout.write(`  ✅  Already complete (${n} controls saved) — skipping all API calls.\n`);
    return;
  }

  const { childPages } = await getPageContent(frameworkPageId);

  // Bridge = child page whose title contains "control" (case-insensitive) but not "polic"
  const bridgePage = childPages.find((c) => {
    const lower = c.title.toLowerCase();
    return lower.includes('control') && !lower.includes('polic');
  });

  if (!bridgePage) {
    console.warn(`⚠  No CONTROLS bridge page found under ${frameworkMeta.code} — skipping`);
    return;
  }

  await walkBridge(bridgePage, frameworkMeta, depth + 1);

  // Mark framework as fully complete so future resumes skip it instantly
  if (!progress.completedFrameworks.includes(frameworkMeta.code)) {
    progress.completedFrameworks.push(frameworkMeta.code);
    saveState();
    process.stdout.write(`  ✅  Framework ${frameworkMeta.code} complete and marked.\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!NOTION_TOKEN?.trim()) {
    console.error('❌  NOTION_TOKEN missing in server/.env');
    process.exit(1);
  }
  if (!FRAMEWORKS_PAGE_ID?.trim()) {
    console.error('❌  NOTION_FRAMEWORKS_PAGE_ID missing in server/.env');
    process.exit(1);
  }

  loadState();

  const startTime = Date.now();

  console.log('\n🚀  fetchControlsFromNotion starting…');
  console.log(`    Frameworks page : ${FRAMEWORKS_PAGE_ID}`);
  console.log(`    Output          : ${OUTPUT_FILE}`);
  console.log(`    Progress file   : ${PROGRESS_FILE}`);
  console.log(`    Mode            : ${RESET ? 'FRESH START (--reset)' : 'RESUME'}`);
  console.log(`    Rate delay      : ${DELAY_MS} ms\n`);

  // Discover top-level framework pages under the root Frameworks page
  const { childPages: topLevel } = await getPageContent(FRAMEWORKS_PAGE_ID);

  for (const page of topLevel) {
    const fwMeta = FRAMEWORKS[page.title];
    if (!fwMeta) {
      console.log(`  ⏭  Skipping non-framework page: "${page.title}"`);
      continue;
    }
    await walkFramework(page.id, fwMeta, 0);
  }

  // Final save with complete stats
  saveState();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(64));
  console.log(`✅  Done in ${elapsed}s`);
  console.log(`    API calls      : ${apiCallCount}`);
  console.log(`    Controls saved : ${outputData.controls.length}`);
  console.log(`    Total tests    : ${outputData.meta.totalTests}`);
  console.log(`    Output         : ${OUTPUT_FILE}`);

  console.log('\n📊  Per-framework stats:');
  for (const [code, s] of Object.entries(progress.stats)) {
    console.log(`    ${code}: ${s.controls} controls, ${s.tests} automated tests, ${s.documents} documents`);
  }

  console.log('\n▶   Next step: npm run seed:build');
}

main().catch((err) => {
  console.error('\n❌  Fatal error:', err.message);
  console.error(err.stack);
  console.error('\n💡  The run was saved up to the last completed control.');
  console.error('    Re-run the same command to resume from where it stopped.');
  process.exit(1);
});
