/**
 * Vanta CSV Transformer
 * 
 * Parses Vanta control CSV exports and generates globalControlTemplates.json
 * Does NOT modify the manually curated requirements/*.json files.
 * 
 * Usage: node src/seeds/transformers/transformAll.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const RAW_DIR = path.join(__dirname, '../raw/controls');
const OUTPUT_DIR = path.join(__dirname, '../data');

// Map CSV filenames to framework codes
const CSV_FILES = [
  { file: 'SOC 2 controls.csv', frameworkCode: 'SOC2', columnName: 'SOC 2' },
  { file: 'ISO 27001_2022 controls.csv', frameworkCode: 'ISO27001', columnName: 'ISO 27001:2022' },
  { file: 'HIPAA controls.csv', frameworkCode: 'HIPAA', columnName: 'HIPAA' },
  { file: 'GDPR with EU-US Data Privacy Framework controls.csv', frameworkCode: 'GDPR', columnName: 'GDPR for US Entities' },
];

// Map Vanta domain codes to readable categories
const DOMAIN_MAP = {
  'HUMAN_RESOURCES_SECURITY': 'Human Resources Security',
  'SECURITY_PRIVACY_GOVERNANCE': 'Security & Privacy Governance',
  'CONTINUOUS_MONITORING': 'Continuous Monitoring',
  'VULNERABILITY_PATCH_MANAGEMENT': 'Vulnerability & Patch Management',
  'INFORMATION_ASSURANCE': 'Information Assurance',
  'THIRD_PARTY_MANAGEMENT': 'Third Party Management',
  'RISK_MANAGEMENT': 'Risk Management',
  'INCIDENT_RESPONSE': 'Incident Response',
  'PROJECT_RESOURCE_MANAGEMENT': 'Project & Resource Management',
  'COMPLIANCE': 'Compliance',
  'SECURITY_AWARENESS_TRAINING': 'Security Awareness Training',
  'IDENTIFICATION_AUTHENTICATION': 'Identification & Authentication',
  'BUSINESS_CONTINUITY_DISASTER_RECOVERY': 'Business Continuity & Disaster Recovery',
  'PHYSICAL_ENVIRONMENTAL_SECURITY': 'Physical & Environmental Security',
  'ENDPOINT_SECURITY': 'Endpoint Security',
  'CRYPTOGRAPHIC_PROTECTIONS': 'Cryptographic Protections',
  'DATA_CLASSIFICATION_HANDLING': 'Data Classification & Handling',
  'ASSET_MANAGEMENT': 'Asset Management',
  'CONFIGURATION_MANAGEMENT': 'Configuration Management',
  'CHANGE_MANAGEMENT': 'Change Management',
  'NETWORK_SECURITY': 'Network Security',
  'PRIVACY': 'Privacy',
  'MAINTENANCE': 'Maintenance',
  'SOFTWARE_DEVELOPMENT': 'Software Development',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse a CSV file and return records
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

/**
 * Parse comma-separated requirement identifiers from a cell
 * e.g., "CC 1.1,CC 1.4,CC 1.5" -> ["CC 1.1", "CC 1.4", "CC 1.5"]
 */
function parseRequirementIds(cellValue) {
  if (!cellValue || cellValue.trim() === '') {
    return [];
  }
  return cellValue
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Normalize domain to readable category
 */
function normalizeCategory(domain) {
  return DOMAIN_MAP[domain] || domain || 'Uncategorized';
}

/**
 * Clean description text (remove extra newlines, trim)
 */
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

// =============================================================================
// MAIN TRANSFORMATION LOGIC
// =============================================================================

function transformAll() {
  console.log('🚀 Starting Vanta CSV transformation...\n');

  // Map to store unique controls by UID
  const controlsMap = new Map();

  // Process each CSV file
  for (const { file, frameworkCode, columnName } of CSV_FILES) {
    const filePath = path.join(RAW_DIR, file);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file}, skipping...`);
      continue;
    }

    console.log(`📄 Processing: ${file}`);
    const records = parseCSV(filePath);
    console.log(`   Found ${records.length} rows`);

    let newControls = 0;
    let updatedControls = 0;

    for (const record of records) {
      const uid = record['UID'];
      const controlId = record['ID'];
      
      if (!uid || !controlId) {
        continue; // Skip rows without proper identification
      }

      // Get requirement identifiers from the specific framework column
      const requirementIds = parseRequirementIds(record[columnName]);
      
      if (requirementIds.length === 0) {
        continue; // Skip if no requirements mapped for this framework
      }

      // Check if we already have this control
      if (controlsMap.has(uid)) {
        // Merge requirements from this framework
        const existing = controlsMap.get(uid);
        
        for (const reqId of requirementIds) {
          // Check if this requirement is already mapped
          const alreadyMapped = existing.suggestedRequirements.some(
            sr => sr.frameworkCode === frameworkCode && sr.identifier === reqId
          );
          
          if (!alreadyMapped) {
            existing.suggestedRequirements.push({
              frameworkCode,
              identifier: reqId,
              coverage: 'FULL',
            });
            updatedControls++;
          }
        }
      } else {
        // Create new control entry
        const control = {
          identifier: controlId,
          title: record['Title'] || '',
          description: cleanDescription(record['Description'] || ''),
          controlGroup: normalizeCategory(record['Domain']),
          frequency: 'QUARTERLY', // Default frequency
          implementationGuidance: '', // Can be populated later
          suggestedRequirements: requirementIds.map(reqId => ({
            frameworkCode,
            identifier: reqId,
            coverage: 'FULL',
          })),
        };

        controlsMap.set(uid, control);
        newControls++;
      }
    }

    console.log(`   ✅ New controls: ${newControls}, Updated: ${updatedControls}\n`);
  }

  // Convert map to array and sort by identifier
  const templates = Array.from(controlsMap.values())
    .sort((a, b) => a.identifier.localeCompare(b.identifier));

  // Write output file
  const outputPath = path.join(OUTPUT_DIR, 'globalControlTemplates.json');
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2), 'utf-8');

  console.log('='.repeat(60));
  console.log(`✅ Generated: ${outputPath}`);
  console.log(`   Total unique control templates: ${templates.length}`);
  
  // Summary of cross-framework mappings
  const crossFrameworkCount = templates.filter(
    t => t.suggestedRequirements.length > 1 && 
    new Set(t.suggestedRequirements.map(r => r.frameworkCode)).size > 1
  ).length;
  console.log(`   Controls with cross-framework mappings: ${crossFrameworkCount}`);
  
  // Summary by control group
  const categoryCount = {};
  for (const t of templates) {
    categoryCount[t.controlGroup] = (categoryCount[t.controlGroup] || 0) + 1;
  }
  console.log('\n📊 Controls by control group:');
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

  // Extract all unique requirement identifiers referenced
  const allRequirements = new Set();
  for (const t of templates) {
    for (const sr of t.suggestedRequirements) {
      allRequirements.add(`${sr.frameworkCode}:${sr.identifier}`);
    }
  }
  console.log(`\n📋 Total unique requirement references: ${allRequirements.size}`);
  
  // Group by framework
  const reqByFramework = {};
  for (const ref of allRequirements) {
    const [fw] = ref.split(':');
    reqByFramework[fw] = (reqByFramework[fw] || 0) + 1;
  }
  for (const [fw, count] of Object.entries(reqByFramework)) {
    console.log(`   ${fw}: ${count} requirements`);
  }

  console.log('\n✨ Transformation complete!');
  console.log('   Note: Requirements files were NOT modified.');
  console.log('   Run "npm run seed" to seed the database.\n');

  return templates;
}

// =============================================================================
// RUN
// =============================================================================

transformAll();
