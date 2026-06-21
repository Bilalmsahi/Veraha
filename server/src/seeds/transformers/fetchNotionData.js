/**
 * Notion Data Fetcher
 *
 * Recursively crawls the Frameworks page tree from Notion and produces
 * nested_objects_notion.json at the project root — the exact format that
 * transformNotionData.js already knows how to parse.
 *
 * Usage:
 *   npm run seed:fetch:notion
 *
 * Required env vars (server/.env):
 *   NOTION_TOKEN                 - Integration secret (secret_...)
 *   NOTION_FRAMEWORKS_PAGE_ID    - Page ID of the top-level Frameworks page
 */

import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const FRAMEWORKS_PAGE_ID = process.env.NOTION_FRAMEWORKS_PAGE_ID;

// Output: project root  (compliance-automation-platform/nested_objects_notion.json)
// transformNotionData.js reads from this exact location.
const OUTPUT_FILE = path.join(__dirname, '../../../../nested_objects_notion.json');

// Delay between Notion API calls — Notion allows 3 requests/second.
// 350 ms keeps us safely under the limit.
const DELAY_MS = 350;

// =============================================================================
// STATE
// =============================================================================

let totalPagesCrawled = 0;
let totalBlocksFetched = 0;
const startTime = Date.now();

// =============================================================================
// NOTION CLIENT
// =============================================================================

const notion = new Client({ auth: NOTION_TOKEN });

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Join all plain_text segments from a Notion rich_text array.
 */
function richTextToPlain(richTextArray) {
  if (!Array.isArray(richTextArray) || richTextArray.length === 0) return '';
  return richTextArray.map((t) => t.plain_text ?? '').join('');
}

/**
 * Extract the text content from a single Notion block.
 * Handles all common block types that carry rich_text.
 */
function extractBlockText(block) {
  const type = block.type;
  const data = block[type];
  if (!data) return '';

  // Blocks that carry rich_text directly
  const richTextTypes = [
    'paragraph',
    'heading_1',
    'heading_2',
    'heading_3',
    'bulleted_list_item',
    'numbered_list_item',
    'toggle',
    'quote',
    'callout',
    'code',
  ];

  if (richTextTypes.includes(type) && data.rich_text) {
    return richTextToPlain(data.rich_text);
  }

  return '';
}

/**
 * Fetch ALL blocks from a page, following Notion's pagination cursor.
 */
async function getAllBlocks(pageId) {
  const allBlocks = [];
  let cursor = undefined;

  do {
    await sleep(DELAY_MS);

    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    });

    allBlocks.push(...response.results);
    totalBlocksFetched += response.results.length;
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return allBlocks;
}

/**
 * Recursively crawl a Notion page and return a node in the shape:
 *   { content: string, subpages: { [title]: node } }
 *
 * This is the exact shape that transformNotionData.js reads.
 */
async function crawlPage(pageId, pageTitle, depth = 0) {
  const indent = '  '.repeat(depth);
  process.stdout.write(`${indent}📄 ${pageTitle}\n`);

  totalPagesCrawled++;

  let blocks;
  try {
    blocks = await getAllBlocks(pageId);
  } catch (err) {
    // Rate limit or access error — log and return an empty node so the rest
    // of the tree still gets written.
    console.error(`${indent}  ⚠️  Could not fetch "${pageTitle}": ${err.message}`);
    return { content: '', subpages: {} };
  }

  // Separate content blocks from child-page / child-database blocks
  const textLines = [];
  const childPageBlocks = [];

  for (const block of blocks) {
    if (block.type === 'child_page') {
      childPageBlocks.push({
        id: block.id,
        title: block.child_page.title ?? 'Untitled',
      });
    } else if (block.type !== 'child_database') {
      const text = extractBlockText(block);
      if (text.trim()) {
        textLines.push(text);
      }
    }
  }

  // In Notion the semantic identifiers and emoji markers (📕, 📖, ⚙️, 🚩, 📜, 📄)
  // live in the PAGE TITLE, not in the body blocks. transformNotionData.js parses
  // these markers from the "content" string, so we MUST include the page title as
  // the first part of the content. Any body text is appended after.
  const content = [pageTitle, ...textLines].filter(Boolean).join(' ').trim();

  // Recurse into child pages
  const subpages = {};
  for (const child of childPageBlocks) {
    subpages[child.title] = await crawlPage(child.id, child.title, depth + 1);
  }

  return { content, subpages };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  // Validate env vars
  if (!NOTION_TOKEN || NOTION_TOKEN.trim() === '') {
    console.error('❌  NOTION_TOKEN is missing or empty in server/.env');
    console.error('    Add: NOTION_TOKEN=secret_...');
    process.exit(1);
  }

  if (!FRAMEWORKS_PAGE_ID || FRAMEWORKS_PAGE_ID.trim() === '') {
    console.error('❌  NOTION_FRAMEWORKS_PAGE_ID is missing or empty in server/.env');
    process.exit(1);
  }

  console.log('🚀  Notion data fetch starting...');
  console.log(`    Frameworks page ID : ${FRAMEWORKS_PAGE_ID}`);
  console.log(`    Output file        : ${OUTPUT_FILE}`);
  console.log(`    Rate limit delay   : ${DELAY_MS}ms per request\n`);

  // Crawl the entire tree starting from the Frameworks page
  const frameworksNode = await crawlPage(FRAMEWORKS_PAGE_ID, 'Frameworks', 0);

  // Build the output object in the shape transformNotionData.js expects
  const output = { Frameworks: frameworksNode };

  // Write JSON
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log(`✅  Fetch complete in ${elapsed}s`);
  console.log(`    Pages crawled  : ${totalPagesCrawled}`);
  console.log(`    Blocks fetched : ${totalBlocksFetched}`);
  console.log(`    Output         : ${OUTPUT_FILE}`);
  console.log('\n▶   Next step: npm run seed:transform:notion');
}

main().catch((err) => {
  console.error('\n❌  Fetch failed:', err.message);
  if (err.code === 'unauthorized') {
    console.error('    Check that NOTION_TOKEN is correct and the integration has access to the Frameworks page.');
  }
  process.exit(1);
});
