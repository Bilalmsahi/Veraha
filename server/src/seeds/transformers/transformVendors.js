/**
 * Vendor Transformer
 * Converts Vanta Vendor Export XLSX → demo/vendors.json
 * 
 * Usage: npm run seed:transform:vendors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RAW_XLSX = path.join(__dirname, '../raw/vendors_data_export.xlsx');
const OUTPUT_JSON = path.join(__dirname, '../demo/vendors.json');

// Risk tier mapping
const RISK_TIER_MAP = {
  'CRITICAL': 'CRITICAL',
  'HIGH': 'HIGH',
  'MEDIUM': 'MEDIUM',
  'LOW': 'LOW',
  'Critical': 'CRITICAL',
  'High': 'HIGH',
  'Medium': 'MEDIUM',
  'Low': 'LOW',
};

// Status mapping
const STATUS_MAP = {
  'Completed': 'ACTIVE',
  'In progress': 'UNDER_REVIEW',
  'Not started': 'UNDER_REVIEW',
  'Archived': 'INACTIVE',
};

// Data type mapping
const DATA_TYPE_MAP = {
  'Customer data': 'CONFIDENTIAL',
  'sensitive data': 'CONFIDENTIAL',
  'Customer metadata': 'CONFIDENTIAL',
  'metadata': 'PUBLIC',
  'PII': 'PII',
  'PHI': 'PHI',
  'Financial': 'FINANCIAL',
};

function parseDataTypes(typesString) {
  if (!typesString) return [];
  
  const types = new Set();
  const lowerStr = typesString.toLowerCase();
  
  if (lowerStr.includes('pii') || lowerStr.includes('personal')) types.add('PII');
  if (lowerStr.includes('phi') || lowerStr.includes('health') || lowerStr.includes('hipaa')) types.add('PHI');
  if (lowerStr.includes('financial') || lowerStr.includes('payment') || lowerStr.includes('billing')) types.add('FINANCIAL');
  if (lowerStr.includes('confidential') || lowerStr.includes('sensitive') || lowerStr.includes('customer data')) types.add('CONFIDENTIAL');
  if (types.size === 0 && typesString.trim()) types.add('CONFIDENTIAL'); // Default if data is processed
  
  return Array.from(types);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle "Jan 15, 2026" format
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return null;
}

function yesNoToBoolean(value) {
  if (!value) return false;
  return value.toLowerCase() === 'yes';
}

async function transformVendors() {
  console.log('🔄 Transforming Vendor Export XLSX...\n');

  // Check if XLSX exists
  if (!fs.existsSync(RAW_XLSX)) {
    console.error('❌ vendors_data_export.xlsx not found at:', RAW_XLSX);
    process.exit(1);
  }

  // Read workbook
  const workbook = xlsx.readFile(RAW_XLSX);
  console.log('📑 Sheets found:', workbook.SheetNames);

  // Read active vendors sheet
  const activeSheet = workbook.Sheets['Active vendors'];
  const activeVendors = xlsx.utils.sheet_to_json(activeSheet);
  console.log(`\n📊 Found ${activeVendors.length} active vendors`);

  // Read archived vendors if exists
  let archivedVendors = [];
  if (workbook.Sheets['Archived vendors']) {
    const archivedSheet = workbook.Sheets['Archived vendors'];
    archivedVendors = xlsx.utils.sheet_to_json(archivedSheet);
    console.log(`📊 Found ${archivedVendors.length} archived vendors`);
  }

  // Transform all vendors
  const allVendors = [
    ...activeVendors.map(v => ({ ...v, _isActive: true })),
    ...archivedVendors.map(v => ({ ...v, _isActive: false })),
  ];

  const vendors = allVendors.map((row, index) => {
    // Determine risk tier
    const riskTierRaw = row['Inherent risk score'] || 'MEDIUM';
    const riskTier = RISK_TIER_MAP[riskTierRaw] || 'MEDIUM';

    // Determine status
    let status;
    if (!row._isActive) {
      status = 'INACTIVE';
    } else {
      const reviewState = row['Security review state'] || '';
      status = STATUS_MAP[reviewState] || 'ACTIVE';
    }

    // Parse data types
    const dataTypes = parseDataTypes(row['Types of data processed']);

    // Build vendor object
    const vendor = {
      name: row['Name'] || `Vendor ${index + 1}`,
      description: row['Services provided'] || '',
      serviceType: row['Services provided'] ? row['Services provided'].substring(0, 100) : 'General',
      category: categorizeVendor(row['Name'], row['Services provided']),
      website: row['Website'] ? `https://${row['Website'].replace(/^https?:\/\//, '')}` : null,
      
      riskTier,
      status,
      
      // Security owner as primary contact
      primaryContact: {
        name: row['Internal security owner'] || '',
        email: row['Security owner'] || '',
      },
      
      // Agreements
      hasNda: false, // Not in export
      hasDpa: yesNoToBoolean(row['Has data protection agreement']),
      hasSla: false, // Not in export
      
      // Assessment
      lastAssessmentDate: parseDate(row['Security review completion date']),
      assessmentFrequency: 'ANNUALLY',
      
      // Data handling
      dataTypes,
      
      // Notes
      notes: row['Comments'] || '',
      
      // Owner info for lookup during seeding
      ownerEmail: row['Security owner'] || '',
      
      // Security details (for reference)
      securityDetails: {
        authMethod: row['Auth method'] || '',
        minPasswordLength: row['Minimum password character length'] || null,
        passwordRequiresNumbers: yesNoToBoolean(row['Password requires numbers']),
        passwordRequiresSymbols: yesNoToBoolean(row['Password requires symbols']),
        mfaEnabled: yesNoToBoolean(row['Two-factor authentication enabled']),
        dataAgreementStatus: row['Data agreement status'] || '',
        hasBaa: yesNoToBoolean(row['Has business associate agreement']),
      },
    };

    return vendor;
  });

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_JSON);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(vendors, null, 2));

  // Summary
  console.log('\n✅ Transformation Complete!\n');
  console.log('📁 Output:', OUTPUT_JSON);
  console.log('\n📈 Statistics:');

  // Count by status
  const statusCounts = vendors.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Status:', statusCounts);

  // Count by risk tier
  const tierCounts = vendors.reduce((acc, v) => {
    acc[v.riskTier] = (acc[v.riskTier] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Risk Tier:', tierCounts);

  // Count by category
  const categoryCounts = vendors.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});
  console.log('   By Category:', categoryCounts);

  console.log('\n🎉 Vendor data ready for seeding!');
}

// Categorize vendor based on name/services
function categorizeVendor(name, services) {
  const combined = `${name || ''} ${services || ''}`.toLowerCase();
  
  if (combined.includes('cloud') || combined.includes('aws') || combined.includes('azure') || combined.includes('gcp')) {
    return 'Cloud Infrastructure';
  }
  if (combined.includes('security') || combined.includes('auth') || combined.includes('identity')) {
    return 'Security';
  }
  if (combined.includes('hr') || combined.includes('payroll') || combined.includes('employee')) {
    return 'HR & Operations';
  }
  if (combined.includes('communication') || combined.includes('slack') || combined.includes('email')) {
    return 'Communication';
  }
  if (combined.includes('analytics') || combined.includes('monitoring') || combined.includes('logging')) {
    return 'Analytics & Monitoring';
  }
  if (combined.includes('payment') || combined.includes('billing') || combined.includes('financial')) {
    return 'Financial Services';
  }
  if (combined.includes('ai') || combined.includes('machine learning') || combined.includes('openai')) {
    return 'AI & Machine Learning';
  }
  if (combined.includes('development') || combined.includes('github') || combined.includes('code')) {
    return 'Development Tools';
  }
  if (combined.includes('storage') || combined.includes('database') || combined.includes('data')) {
    return 'Data & Storage';
  }
  
  return 'General Services';
}

// Run
transformVendors().catch(console.error);
