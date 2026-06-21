/**
 * Notion Nested Data Transformer
 *
 * Extracts compliance hierarchy from nested_objects_notion.json and generates:
 * - data/requirementCategories.json
 * - data/requirements/{soc2,iso27001,hipaa,gdpr}.json
 * - data/globalControlTemplates.json
 * - data/globalTestTemplates.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../../../../nested_objects_notion.json');
const OUTPUT_DIR = path.join(__dirname, '../data');
const REQUIREMENTS_DIR = path.join(OUTPUT_DIR, 'requirements');

const FRAMEWORKS = [
  { key: 'SOC2', code: 'SOC2', bridgeContains: ['controls'], controlPrefix: 'SOC' },
  { key: 'ISO27001', code: 'ISO27001', bridgeContains: ['controls'], controlPrefix: 'ISO' },
  { key: 'HIPAA', code: 'HIPAA', bridgeContains: ['controls'], controlPrefix: 'HIP' },
  { key: 'GDPR', code: 'GDPR', bridgeContains: ['controls'], controlPrefix: 'GDPR' },
];

const FILE_EXT_PATTERN = /\.(pdf|docx|xlsx|csv|png|jpg|jpeg|gif|txt)$/i;
const NOTION_UI_ARTIFACTS = /(fa-[a-z-]+\s+alpaca-fa-[a-z-]+)/gi;

const POLICY_CHECK_TO_SLUG = {
  'company has an approved code of conduct': 'code-of-conduct-bsi',
  'company has an approved information security policy (aup)': 'information-security-policy-bsi',
  'company has an approved operations security policy': 'operations-security-policy-bsi',
  'company has an approved incident response plan': 'incident-response-plan-bsi',
  'company has an approved risk management policy': 'risk-management-policy-bsi',
  'company has an approved asset management policy': 'asset-management-policy-bsi',
  'company has an approved data management policy': 'data-management-policy-bsi',
  'company has an approved human resource security policy': 'human-resource-security-policy-bsi',
  'company has an approved physical security policy': 'physical-security-policy-bsi',
  'company has an approved third-party management policy': 'third-party-management-policy-bsi',
  'company has an approved cryptography policy': 'cryptography-policy-bsi',
  'company has an approved secure development policy': 'secure-development-policy-bsi',
  'company has an approved business continuity and disaster recovery plan':
    'business-continuity-and-disaster-recovery-plan-bsi',
  'company has an approved gdpr compliance policy': 'gdpr-compliance-policy',
  'company has an approved incident response plan hipaa addendum with breach notification procedures':
    'incident-response-plan-hipaa-addendum-with-breach-notification-procedures-bsi',
  'company has an approved hipaa compliance policy': 'hipaa-compliance-policy-bsi',
  'personnel agree to information security policy': 'information-security-policy-bsi',
  'personnel agree to code of conduct': 'code-of-conduct-bsi',
  'personnel agree to operations security policy': 'operations-security-policy-bsi',
  'personnel agree to incident response plan': 'incident-response-plan-bsi',
  'personnel agree to human resource security policy': 'human-resource-security-policy-bsi',
  'personnel agree to physical security policy': 'physical-security-policy-bsi',
  'personnel agree to asset management policy': 'asset-management-policy-bsi',
  'personnel agree to data management policy': 'data-management-policy-bsi',
  'personnel agree to secure development policy': 'secure-development-policy-bsi',
  'personnel agree to access control policy': 'access-control-policy-bsi',
  'personnel agree to information security roles and responsibilities':
    'information-security-roles-and-responsibilities-bsi',
};

function normalizeName(value) {
  return cleanText(value).toLowerCase().trim();
}

function cleanText(value) {
  if (!value) return '';
  return String(value)
    .replace(NOTION_UI_ARTIFACTS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// FIX Bug 3: Split on any child-level emoji at any position (no leading space required).
// The old version used indexOf(' ⚙️ ') which missed the case where the body starts
// directly with an emoji, causing control listings to bleed into requirement descriptions.
function stripChildListing(text) {
  if (!text) return '';
  const result = text.split(/(?:⚙️|🚩|📜|📄|📝|📕|📖)/)[0];
  return cleanText(result);
}

function getTitleFromContent(content, marker) {
  if (!content) return '';
  const raw = cleanText(content);
  const idx = raw.indexOf(marker);
  // When the expected marker is absent, strip child-listing emoji before returning
  // so that ⚙️/🚩/📜 listings never bleed into requirement/control titles.
  if (idx < 0) return stripChildListing(raw);
  return cleanText(raw.slice(0, idx));
}

function getBodyFromContent(content, marker, title) {
  if (!content) return '';
  const raw = cleanText(content);
  const idx = raw.indexOf(marker);
  if (idx < 0) return '';
  let body = cleanText(raw.slice(idx + marker.length));
  if (title && body.toLowerCase().startsWith(title.toLowerCase())) {
    body = cleanText(body.slice(title.length));
  }
  return stripChildListing(body);
}

function parseListedItems(controlContent) {
  const text = cleanText(controlContent).replace(/\bDocs:\b/gi, ' ');
  // Must use the 'u' flag so emoji in character classes are treated as full
  // Unicode codepoints (not individual surrogate code units). Without 'u', the
  // comparison emoji === '🚩' always fails and every item becomes 'document'.
  const regex = /([🚩📜📄])\s*([^🚩📜📄📝⚙️📕📖]+)/gu;
  const items = [];
  let match;
  while ((match = regex.exec(text))) {
    const emoji = match[1];
    const name = cleanText(match[2]);
    if (name) items.push({ name, type: emoji === '🚩' ? 'automated' : 'document' });
  }
  return items;
}

// Extract control names listed as ⚙️ items in a requirement's content string.
// Used for Pass 2 to catch controls that appear only inline (no subpage node).
function parseControlListings(content) {
  if (!content) return [];
  const regex = /⚙️\s*([^⚙️🚩📜📄📝📕📖]+)/gu;
  const names = [];
  let match;
  while ((match = regex.exec(content))) {
    const name = cleanText(match[1]);
    if (name) names.push(name);
  }
  return names;
}

function extractShortTitleAndGuidance(name) {
  const cleaned = cleanText(name);
  if (!cleaned) return { title: '', guidance: '' };
  if (cleaned.length <= 100) return { title: cleaned, guidance: '' };

  const guidanceRe = /\s+(Provide\b|Acceptable evidence\b|Guidance:|Evidence of\b|Must include\b|Must be\b|This test\b|Please\b|The company's\b)/i;
  const match = cleaned.match(guidanceRe);
  if (!match || typeof match.index !== 'number' || match.index <= 20) {
    return { title: cleaned, guidance: '' };
  }

  return {
    title: cleanText(cleaned.slice(0, match.index)),
    guidance: cleanText(cleaned.slice(match.index)),
  };
}

function inferTestCategory(controlGroup, name) {
  const source = `${controlGroup || ''} ${name || ''}`.toLowerCase();
  if (/(policy|code of conduct|privacy|hipaa|gdpr|isms)/.test(source)) return 'Policy';
  if (/(personnel|employee|contractor|hr|human resource)/.test(source)) return 'Human resources';
  if (/(risk|threat)/.test(source)) return 'Risks';
  if (/(legal|agreement|contract|dpa|msa)/.test(source)) return 'Legal';
  if (/(finance|billing|invoice|tax)/.test(source)) return 'Finance';
  if (/(board|management|oversight)/.test(source)) return 'Management';
  return 'Engineering';
}

// When a Notion node has no 📖 marker its content may contain the page title
// twice (Notion sometimes repeats it). Strip the second occurrence so the
// requirement title doesn't include the identifier again.
function deduplicateTitle(identifier, title) {
  if (!title || !identifier) return title;
  const dupIdx = title.indexOf(identifier);
  if (dupIdx > 0) return cleanText(title.slice(0, dupIdx));
  return title;
}

function deriveRequirementIdentifierAndTitle(frameworkCode, line) {
  const text = cleanText(line);
  if (!text) return { identifier: null, title: null };

  if (frameworkCode === 'SOC2') {
    const match = text.match(/^([A-Z]+\s+\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      const identifier = cleanText(match[1]);
      const title = deduplicateTitle(identifier, cleanText(match[2])) || identifier;
      return { identifier, title };
    }
    // No SOC2 pattern matched — return null so Bug 5 fallback can handle this node
    return { identifier: null, title: null };
  }

  if (frameworkCode === 'ISO27001') {
    const match = text.match(/^([A-Z]\.\d+\.\d+)\s*(.*)$/);
    if (match) {
      const identifier = cleanText(match[1]);
      const title = deduplicateTitle(identifier, cleanText(match[2])) || identifier;
      return { identifier, title };
    }
    return { identifier: null, title: null };
  }

  if (frameworkCode === 'HIPAA') {
    const match = text.match(/^(\d{3}\.\d{3}[^\s]*)\s*(.*)$/);
    if (match) {
      const identifier = cleanText(match[1]);
      const title = deduplicateTitle(identifier, cleanText(match[2])) || identifier;
      return { identifier, title };
    }
    // Nodes like "Additional breach information" (HP404) don't have a 164.xxx identifier.
    // Returning null triggers the Bug 5 direct-control fallback path.
    return { identifier: null, title: null };
  }

  if (frameworkCode === 'GDPR') {
    const article = text.match(/^(Article\s+\d+)\s*(.*)$/i);
    if (article) {
      const braces = article[2].match(/\{([^}]+)\}/);
      const rawTitle = braces ? braces[1] : article[2];
      const identifier = cleanText(article[1]);
      const title = deduplicateTitle(identifier, cleanText(rawTitle)) || identifier;
      return { identifier, title };
    }
    const dpf = text.match(/^(EU-USDPF-[A-Z]+)\s*(.*)$/i);
    if (dpf) {
      const identifier = cleanText(dpf[1]);
      const title = deduplicateTitle(identifier, cleanText(dpf[2])) || identifier;
      return { identifier, title };
    }
    return { identifier: null, title: null };
  }

  // Unknown framework — generic fallback using first word
  const firstSpace = text.indexOf(' ');
  if (firstSpace < 0) return { identifier: text, title: text };
  return { identifier: cleanText(text.slice(0, firstSpace)), title: cleanText(text.slice(firstSpace + 1)) };
}

function deriveCategory(frameworkCode, categoryLine) {
  const text = cleanText(categoryLine);
  if (!text) return null;

  if (frameworkCode === 'SOC2') {
    if (/^SD\b/i.test(text)) return null;
    const match = text.match(/^([A-Z]+)\s+(\d+)(?:\.0)?\s*(.*)$/);
    if (!match) return null;
    return {
      code: `${match[1]}${match[2]}`,
      title: cleanText(match[3]) || text,
    };
  }

  if (frameworkCode === 'ISO27001') {
    if (!/^A\./i.test(text)) return null;
    const match = text.match(/^(A)\.(\d+)\s*(.*)$/i);
    if (!match) return null;
    return {
      code: `${match[1].toUpperCase()}${match[2]}`,
      title: cleanText(match[3]) || text,
    };
  }

  if (frameworkCode === 'HIPAA') {
    const match = text.match(/^164\.(\d{3})\s*(.*)$/);
    if (!match) return null;
    return {
      code: `HIP${match[1]}`,
      title: cleanText(match[2]) || text,
    };
  }

  if (frameworkCode === 'GDPR') {
    const chapter = text.match(/^Chapter\s+(\d+)\s*(.*)$/i);
    if (chapter) {
      const braceMatch = chapter[2].match(/\{([^}]+)\}/);
      const title = braceMatch ? braceMatch[1] : chapter[2];
      return { code: `GDPR_CH${chapter[1]}`, title: cleanText(title) || text };
    }
    if (/^EU-US-DPF/i.test(text)) {
      return { code: 'GDPR_DPF', title: cleanText(text.replace(/^EU-US-DPF\s*/i, '')) || 'EU US Data Privacy Framework' };
    }
  }

  return null;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findBridgeNode(frameworkNode) {
  const subpages = frameworkNode?.subpages || {};
  for (const [key, node] of Object.entries(subpages)) {
    const lower = key.toLowerCase();
    if (lower.includes('control') && !lower.includes('polic')) return node;
  }
  return null;
}

function transform() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const frameworkRoot = raw?.Frameworks?.subpages || {};

  const categories = [];
  const requirementsByFramework = {
    soc2: [],
    iso27001: [],
    hipaa: [],
    gdpr: [],
  };
  const controls = [];
  const tests = [];

  const controlMap = new Map();
  const testMap = new Map();
  const counters = { SOC: 0, ISO: 0, HIP: 0, GDPR: 0 };
  const frameworkStats = {};

  // ---------------------------------------------------------------------------
  // processTestsForControl: handles depth-3 (tests/docs) under a control node.
  // Extracted so it can be called from both the normal path and the HIPAA-style
  // direct-control fallback path (Bug 5 fix).
  // ---------------------------------------------------------------------------
  function processTestsForControl(controlNode, controlRecord, framework) {
    const listedItems = parseListedItems(controlNode.content);
    const listedTypeByName = new Map(listedItems.map((item) => [normalizeName(item.name), item.type]));
    const pass1Names = new Set();

    // Pass 1: iterate actual subpages (depth-3 nodes with their own content)
    const depth3Entries = Object.entries(controlNode.subpages || {});
    for (const [itemKey, itemNode] of depth3Entries) {
      if (!itemNode?.content) continue;
      if (FILE_EXT_PATTERN.test(itemKey)) continue;

      // FIX Bug 1: Always derive title from the subpage key, not from content-parsing.
      // The old approach extracted text before the first 📄/📜 anywhere in content,
      // causing automated test titles to become huge content blobs when trailing policy
      // references (e.g. "📄 Code of Conduct") existed in the content.
      const rawTitle = cleanText(itemKey);
      const { title: resolvedTitle, guidance: extractedGuidance } = extractShortTitleAndGuidance(rawTitle);
      const normalized = normalizeName(resolvedTitle);
      pass1Names.add(normalized);

      // FIX Bug 2: Determine type from the FIRST structural emoji in content,
      // not from ANY occurrence. Old code used includes('📜')||includes('📄') which
      // triggered on trailing child references, misclassifying automated tests.
      const rawContent = cleanText(itemNode.content || '');
      const testIdx = rawContent.indexOf('🚩');
      const doc1Idx = rawContent.includes('📜') ? rawContent.indexOf('📜') : Infinity;
      const doc2Idx = rawContent.includes('📄') ? rawContent.indexOf('📄') : Infinity;
      const firstDocIdx = Math.min(doc1Idx, doc2Idx);

      let itemType = listedTypeByName.get(normalized);
      if (!itemType) {
        itemType = (testIdx !== -1 && testIdx < firstDocIdx) ? 'automated' : 'document';
      }

      // bodyMarker: use the first-occurring doc emoji for documents, 🚩 for automated
      const bodyMarker = itemType === 'document'
        ? (doc1Idx <= doc2Idx ? '📜' : '📄')
        : '🚩';
      const rawBody = getBodyFromContent(itemNode.content, bodyMarker, resolvedTitle);

      // Heuristic: if the body starts with evidence-request keywords, force document
      if (itemType !== 'document' && /^(provide|upload|submit|attach)\b/i.test(rawBody || '')) {
        itemType = 'document';
      }

      // Fallback for Notion API data: no emoji markers in content.
      // Two storage patterns exist:
      //   (a) content = "[page title] [body text]"  → body is everything after the title
      //   (b) content = "[body text only]"           → body IS the full content string
      let effectiveBody = rawBody;
      if (!effectiveBody && rawContent) {
        const titleIdx = rawContent.indexOf(resolvedTitle);
        if (titleIdx === 0 && rawContent.length > resolvedTitle.length) {
          // Pattern (a): title is at the very start, extract what follows
          effectiveBody = cleanText(rawContent.slice(resolvedTitle.length));
        } else if (titleIdx < 0) {
          // Pattern (b): title not present → content itself is the body text
          effectiveBody = rawContent;
        }
      }

      if (itemType === 'document') {
        // Policy-check name matches known slug map → automated (works without body text)
        if (POLICY_CHECK_TO_SLUG[normalized]) {
          itemType = 'automated';
        // Descriptive body language indicating an automated verification check
        } else if (effectiveBody && /^(this .{0,25}verif|verif(ies|y)\b|vanta (verif|checks)|the system (verif|checks))/i.test(effectiveBody)) {
          itemType = 'automated';
        }
      }
      // Re-apply evidence-request heuristic using the richer effectiveBody
      if (itemType !== 'document' && /^(provide|upload|submit|attach)\b/i.test(effectiveBody || '')) {
        itemType = 'document';
      }

      let description = '';
      let evidenceGuidance = '';
      if (itemType === 'document') {
        description = resolvedTitle;
        evidenceGuidance = effectiveBody || extractedGuidance || '';
      } else {
        description = effectiveBody || '';
        evidenceGuidance = '';
      }

      const testKey = normalized;
      let testRecord = testMap.get(testKey);
      if (!testRecord) {
        // FIX Bug 4: Mark records created from subpages so listing-based occurrences
        // cannot override a type or description already established from real content.
        testRecord = {
          name: resolvedTitle,
          description,
          evidenceGuidance,
          type: itemType,
          category: inferTestCategory(controlRecord.controlGroup, resolvedTitle),
          renewalPeriod: 'annually',
          suggestedControlIdentifiers: [],
          _fromSubpage: true,
        };
        testMap.set(testKey, testRecord);
        tests.push(testRecord);
      } else if (!testRecord._fromSubpage) {
        // The existing record was created by a listing (pass 2) with description=name.
        // A subpage (pass 1) finding provides richer content — always win over listing.
        testRecord.type = itemType;
        testRecord.description = description || testRecord.description;
        testRecord.evidenceGuidance = evidenceGuidance || testRecord.evidenceGuidance;
        testRecord._fromSubpage = true;
      } else {
        // Both from subpages — only fill genuinely empty fields.
        if (!testRecord.description && description) testRecord.description = description;
        if (!testRecord.evidenceGuidance && evidenceGuidance) testRecord.evidenceGuidance = evidenceGuidance;
      }

      if (!testRecord.suggestedControlIdentifiers.includes(controlRecord.identifier)) {
        testRecord.suggestedControlIdentifiers.push(controlRecord.identifier);
      }

      if (itemType === 'automated') {
        const slug = POLICY_CHECK_TO_SLUG[testKey];
        if (slug && !controlRecord.suggestedPolicySlugs.includes(slug)) {
          controlRecord.suggestedPolicySlugs.push(slug);
        }
        frameworkStats[framework.code].tests += 1;
      } else {
        frameworkStats[framework.code].documents += 1;
      }
    }

    // Pass 2: extract listed items that appear in the control's content string
    // but have no dedicated subpage. These only have the name from the listing.
    for (const listed of listedItems) {
      const { title: listedTitle, guidance: listedGuidance } = extractShortTitleAndGuidance(listed.name);
      const normalized = normalizeName(listedTitle);
      if (pass1Names.has(normalized)) continue;

      let testRecord = testMap.get(normalized);
      if (!testRecord) {
        // FIX Bug 5 (pass 2): Use name as description for both types — automated tests
        // listed here have no subpage content, so the name is the best available text.
        testRecord = {
          name: listedTitle,
          description: listedTitle,
          evidenceGuidance: listed.type === 'document' ? listedGuidance : '',
          type: listed.type,
          category: inferTestCategory(controlRecord.controlGroup, listedTitle),
          renewalPeriod: 'annually',
          suggestedControlIdentifiers: [],
          _fromSubpage: false,
        };
        testMap.set(normalized, testRecord);
        tests.push(testRecord);
      } else if (!testRecord._fromSubpage && listed.type === 'document' && testRecord.type !== 'document') {
        testRecord.type = 'document';
      }

      if (!testRecord.suggestedControlIdentifiers.includes(controlRecord.identifier)) {
        testRecord.suggestedControlIdentifiers.push(controlRecord.identifier);
      }

      if (listed.type === 'automated') {
        const slug = POLICY_CHECK_TO_SLUG[normalized];
        if (slug && !controlRecord.suggestedPolicySlugs.includes(slug)) {
          controlRecord.suggestedPolicySlugs.push(slug);
        }
        frameworkStats[framework.code].tests += 1;
      } else {
        frameworkStats[framework.code].documents += 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // processControlNode: builds or updates a control record, links it to a
  // requirement, and processes its tests/docs. Extracted as a helper so it can
  // be called from both the normal depth-3 path and the Bug 5 fallback path
  // where a depth-2 Notion node is actually a control (no 📖 requirement marker).
  // ---------------------------------------------------------------------------
  function processControlNode(controlKey, controlNode, framework, category, reqIdentifier) {
    if (!controlNode?.content) return;
    if (FILE_EXT_PATTERN.test(controlKey)) return;

    // Prefer the page key (Notion page title) as the control title over content-parsing.
    // When emoji markers are present (⚙️), content-parsing takes priority so legacy data
    // still works. Otherwise we use the key directly to avoid body-text contamination.
    const rawContent = cleanText(controlNode.content || '');
    let controlTitle;
    let controlDescription;
    if (rawContent.includes('⚙️')) {
      controlTitle = getTitleFromContent(rawContent, '⚙️');
      controlDescription = getBodyFromContent(rawContent, '⚙️', controlTitle);
    } else {
      controlTitle = cleanText(controlKey).replace(/\s*(fa-[a-z-]+\s+alpaca-fa-[a-z-]+)/gi, '').trim();
      // Description: everything in content after the page title (if present), or full content
      const titleIdx = rawContent.indexOf(controlTitle);
      if (titleIdx === 0 && rawContent.length > controlTitle.length) {
        controlDescription = cleanText(rawContent.slice(controlTitle.length));
      } else if (titleIdx < 0) {
        controlDescription = rawContent;
      } else {
        controlDescription = '';
      }
      // Strip trailing "Tests: / Documents: / Evidence:" listings from description
      controlDescription = controlDescription.replace(/\s*(tests?|documents?|evidence|policies):\s*[\s\S]*/i, '').trim();
    }
    if (!controlTitle) return;

    const controlKeyNormalized = `${framework.code}:${normalizeName(controlTitle)}`;
    let controlRecord = controlMap.get(controlKeyNormalized);
    if (!controlRecord) {
      counters[framework.controlPrefix] += 1;
      const ctlId = `CTL-${framework.controlPrefix}-${String(counters[framework.controlPrefix]).padStart(4, '0')}`;
      controlRecord = {
        identifier: ctlId,
        title: controlTitle,
        description: controlDescription || '',
        controlGroup: category.title,
        suggestedPolicySlugs: [],
        defaultManualStatus: 'NOT_APPLICABLE',
        frequency: 'QUARTERLY',
        implementationGuidance: '',
        suggestedRequirements: [],
      };
      controlMap.set(controlKeyNormalized, controlRecord);
      controls.push(controlRecord);
      frameworkStats[framework.code].controls += 1;
    } else if (!controlRecord.description && controlDescription) {
      controlRecord.description = controlDescription;
    }

    const srKey = `${framework.code}:${reqIdentifier}`;
    if (!controlRecord.suggestedRequirements.some((sr) => `${sr.frameworkCode}:${sr.identifier}` === srKey)) {
      controlRecord.suggestedRequirements.push({
        frameworkCode: framework.code,
        identifier: reqIdentifier,
        coverage: 'FULL',
      });
    }

    processTestsForControl(controlNode, controlRecord, framework);
  }

  // ---------------------------------------------------------------------------
  // Main hierarchy walk
  // ---------------------------------------------------------------------------
  for (const framework of FRAMEWORKS) {
    const frameworkNode = frameworkRoot[framework.key];
    if (!frameworkNode) continue;

    frameworkStats[framework.code] = { categories: 0, requirements: 0, controls: 0, tests: 0, documents: 0 };

    const bridge = findBridgeNode(frameworkNode);
    if (!bridge) continue;

    const categoryEntries = Object.entries(bridge.subpages || {});
    let order = 1;

    for (const [categoryKey, categoryNode] of categoryEntries) {
      if (!categoryNode?.content) continue;
      if (FILE_EXT_PATTERN.test(categoryKey)) continue;
      if (framework.code === 'SOC2' && /^SD\b/i.test(categoryKey)) continue;

      const categoryLabel = getTitleFromContent(categoryNode.content, '📕');
      const category = deriveCategory(framework.code, categoryLabel);
      if (!category) continue;

      categories.push({
        frameworkCode: framework.code,
        code: category.code,
        title: category.title,
        order,
      });
      frameworkStats[framework.code].categories += 1;
      order += 1;

      // Track whether a synthetic catch-all requirement has been created for this
      // category (used when depth-2 nodes are direct controls without 📖, Bug 5 fix).
      let syntheticReqCreated = false;
      const syntheticReqId = `${category.code}_GEN`;

      const requirementEntries = Object.entries(categoryNode.subpages || {});
      for (const [reqKey, reqNode] of requirementEntries) {
        if (!reqNode?.content) continue;
        if (FILE_EXT_PATTERN.test(reqKey)) continue;

        const reqLine = getTitleFromContent(reqNode.content, '📖');
        const { identifier: reqIdentifier, title: reqTitle } = deriveRequirementIdentifierAndTitle(
          framework.code,
          reqLine,
        );

        // FIX Bug 5: When we can't derive a requirement identifier but the node content
        // has ⚙️ (meaning it IS a control, not a requirement), treat the node as a
        // direct control. We collapse the category-as-requirement pattern: use the
        // category code as the requirement identifier so that in the UI these controls
        // appear grouped under their parent category without an extra phantom level.
        if (!reqIdentifier) {
          if (reqNode.content && reqNode.content.includes('⚙️')) {
            if (!syntheticReqCreated) {
              requirementsByFramework[framework.code.toLowerCase()].push({
                frameworkCode: framework.code,
                categoryCode: category.code,
                identifier: syntheticReqId,
                title: category.title,
                description: '',
              });
              frameworkStats[framework.code].requirements += 1;
              syntheticReqCreated = true;
            }
            processControlNode(reqKey, reqNode, framework, category, syntheticReqId);
          }
          continue;
        }

        // Normal requirement processing
        const reqDescription = getBodyFromContent(reqNode.content, '📖', reqLine);

        requirementsByFramework[framework.code.toLowerCase()].push({
          frameworkCode: framework.code,
          categoryCode: category.code,
          identifier: reqIdentifier,
          title: reqTitle || reqIdentifier,
          description: reqDescription || '',
        });
        frameworkStats[framework.code].requirements += 1;

        const controlEntries = Object.entries(reqNode.subpages || {});
        for (const [controlKey, controlNode] of controlEntries) {
          processControlNode(controlKey, controlNode, framework, category, reqIdentifier);
        }

        // Pass 2: link controls that appear only in this requirement's content text
        // (no dedicated subpage). This handles cases like A 1.3 "Recovery plan
        // testing" where both controls are listed inline as ⚙️ items but have no
        // child nodes. Build a dedup set of already-processed subpage names first.
        const pass1Names = new Set(
          controlEntries
            .map(([, n]) => getTitleFromContent(n?.content, '⚙️'))
            .filter(Boolean)
            .map(normalizeName)
        );
        for (const name of parseControlListings(reqNode.content)) {
          const normalized = normalizeName(name);
          if (pass1Names.has(normalized)) continue; // already processed as subpage
          const key = `${framework.code}:${normalized}`;
          let controlRecord = controlMap.get(key);
          if (controlRecord) {
            // Control exists from its canonical location — just add this requirement
            const srKey = `${framework.code}:${reqIdentifier}`;
            if (!controlRecord.suggestedRequirements.some((sr) => `${sr.frameworkCode}:${sr.identifier}` === srKey)) {
              controlRecord.suggestedRequirements.push({ frameworkCode: framework.code, identifier: reqIdentifier, coverage: 'FULL' });
            }
          } else {
            // New control known only from this listing — create a minimal stub entry
            counters[framework.controlPrefix] += 1;
            const ctlId = `CTL-${framework.controlPrefix}-${String(counters[framework.controlPrefix]).padStart(4, '0')}`;
            controlRecord = {
              identifier: ctlId,
              title: name,
              description: '',
              controlGroup: category.title,
              suggestedPolicySlugs: [],
              defaultManualStatus: 'NOT_APPLICABLE',
              frequency: 'QUARTERLY',
              implementationGuidance: '',
              suggestedRequirements: [{ frameworkCode: framework.code, identifier: reqIdentifier, coverage: 'FULL' }],
            };
            controlMap.set(key, controlRecord);
            controls.push(controlRecord);
            frameworkStats[framework.code].controls += 1;
          }
        }
      }
    }
  }

  // Strip internal processing flag before serialising
  const cleanedTests = tests.map(({ _fromSubpage, ...rest }) => rest);

  ensureDir(OUTPUT_DIR);
  ensureDir(REQUIREMENTS_DIR);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'requirementCategories.json'), JSON.stringify(categories, null, 2));
  fs.writeFileSync(path.join(REQUIREMENTS_DIR, 'soc2.json'), JSON.stringify(requirementsByFramework.soc2, null, 2));
  fs.writeFileSync(path.join(REQUIREMENTS_DIR, 'iso27001.json'), JSON.stringify(requirementsByFramework.iso27001, null, 2));
  fs.writeFileSync(path.join(REQUIREMENTS_DIR, 'hipaa.json'), JSON.stringify(requirementsByFramework.hipaa, null, 2));
  fs.writeFileSync(path.join(REQUIREMENTS_DIR, 'gdpr.json'), JSON.stringify(requirementsByFramework.gdpr, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'globalControlTemplates.json'), JSON.stringify(controls, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'globalTestTemplates.json'), JSON.stringify(cleanedTests, null, 2));

  console.log('\n=== Notion Transform Summary ===');
  for (const [frameworkCode, stats] of Object.entries(frameworkStats)) {
    console.log(
      `${frameworkCode}: categories=${stats.categories}, requirements=${stats.requirements}, controls=${stats.controls}, tests=${stats.tests}, documents=${stats.documents}`
    );
  }
  console.log(`TOTAL controls: ${controls.length}`);
  console.log(`TOTAL test templates: ${cleanedTests.length}`);
  console.log('===============================\n');
}

try {
  transform();
} catch (error) {
  console.error('Transform failed:', error.message);
  process.exit(1);
}
