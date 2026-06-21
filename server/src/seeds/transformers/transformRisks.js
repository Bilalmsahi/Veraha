/**
 * Risk Transformer
 * Converts Vanta Risk Register CSV → demo/risks.json
 * 
 * Usage: npm run seed:transform:risks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RAW_CSV = path.join(__dirname, '../raw/Risk Register.csv');
const OUTPUT_JSON = path.join(__dirname, '../demo/risks.json');

// Treatment mapping (Vanta → Our enum)
const TREATMENT_MAP = {
  'Mitigate': 'MITIGATE',
  'Accept': 'ACCEPT',
  'Transfer': 'TRANSFER',
  'Avoid': 'AVOID',
};

// Status mapping (Vanta → Our enum)
const STATUS_MAP = {
  'Done': 'CLOSED',
  'In progress': 'OPEN',
  'Not started': 'OPEN',
};

// Risk level calculation (same logic as Risk model)
function calculateRiskLevel(score) {
  if (score >= 20) return 'CRITICAL';
  if (score >= 12) return 'HIGH';
  if (score >= 6) return 'MEDIUM';
  return 'LOW';
}

async function transformRisks() {
  console.log('🔄 Transforming Risk Register CSV...\n');

  // Check if CSV exists
  if (!fs.existsSync(RAW_CSV)) {
    console.error('❌ Risk Register.csv not found at:', RAW_CSV);
    process.exit(1);
  }

  // Read and parse CSV
  const csvContent = fs.readFileSync(RAW_CSV, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Found ${records.length} risks in CSV\n`);

  // Transform each record
  const risks = records.map((row, index) => {
    // Parse control IDs (comma-separated in CSV)
    const controlIds = row['Control IDs']
      ? row['Control IDs'].split(',').map(id => id.trim()).filter(Boolean)
      : [];

    // Parse scores
    const likelihood = parseInt(row['Likelihood'], 10) || 1;
    const impact = parseInt(row['Impact'], 10) || 1;
    const inherentScore = parseInt(row['Inherent Risk Score'], 10) || (likelihood * impact);
    
    const residualLikelihood = parseInt(row['Residual Likelihood'], 10) || 1;
    const residualImpact = parseInt(row['Residual Impact'], 10) || 1;
    const residualScore = parseInt(row['Residual Risk Score'], 10) || (residualLikelihood * residualImpact);

    // Build the risk object
    const risk = {
      identifier: row['Risk ID'] || `R-AUTO-${index + 1}`,
      title: row['Risk Scenario'] || 'Untitled Risk',
      description: row['Notes'] || '',
      category: row['Category'] || 'Uncategorized',
      
      // Scoring
      likelihood,
      impact,
      inherentScore,
      riskLevel: calculateRiskLevel(inherentScore),
      
      // Residual (after mitigations)
      residualScore,
      residualRiskLevel: calculateRiskLevel(residualScore),
      
      // Treatment
      treatment: TREATMENT_MAP[row['Risk Treatment']] || 'MITIGATE',
      treatmentPlan: row['Tasks'] || '',
      status: STATUS_MAP[row['Treatment Status']] || 'OPEN',
      
      // Control linkage (will be resolved during seeding)
      controlIdentifiers: controlIds,
      
      // Metadata
      ownerName: row['Risk Owner Name'] || 'Unassigned',
      ownerEmail: row['Risk Owner'] || '',
      ciaCategory: row['CIA Category'] || '',
      
      // Dates
      identifiedAt: row['Identified At'] || null,
      approvedAt: row['Approved At'] || null,
    };

    return risk;
  });

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_JSON);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(risks, null, 2));

  // Summary
  console.log('✅ Transformation Complete!\n');
  console.log('📁 Output:', OUTPUT_JSON);
  console.log('\n📈 Statistics:');
  
  // Count by status
  const statusCounts = risks.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Status:', statusCounts);

  // Count by treatment
  const treatmentCounts = risks.reduce((acc, r) => {
    acc[r.treatment] = (acc[r.treatment] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Treatment:', treatmentCounts);

  // Count by risk level
  const levelCounts = risks.reduce((acc, r) => {
    acc[r.riskLevel] = (acc[r.riskLevel] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Inherent Risk Level:', levelCounts);

  // Count by category
  const categoryCounts = risks.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Category:', categoryCounts);

  // Control linkages
  const withControls = risks.filter(r => r.controlIdentifiers.length > 0).length;
  console.log(`   With Controls: ${withControls}/${risks.length}`);

  console.log('\n🎉 Risk data ready for seeding!');
}

// Run
transformRisks().catch(console.error);
