import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK_DIR = path.join(__dirname, '../../../../seeding-from-network-tab');
const OUTPUT_FILE = path.join(__dirname, '../demo/controlDrawerMappings.json');

function readJson(filename) {
  const filePath = path.join(NETWORK_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeFrameworkCode(standard) {
  const value = String(standard || '').toLowerCase();
  if (value.startsWith('soc2')) return 'SOC2';
  if (value.startsWith('iso27001')) return 'ISO27001';
  if (value.startsWith('hipaa')) return 'HIPAA';
  if (value.startsWith('gdpr')) return 'GDPR';
  return String(standard || '').toUpperCase();
}

function mapEvidenceStatus(uploadStatus) {
  if (uploadStatus === 'OK') return 'APPROVED';
  if (uploadStatus === 'MISSING') return 'PENDING';
  return 'PENDING';
}

function mapEvidenceCategory(category) {
  const key = String(category || '').toUpperCase();
  const mapping = {
    POLICIES: 'Policy',
    EMPLOYEES: 'Procedure',
    VENDORS: 'Report',
    SOFTWARE_DEVELOPMENT: 'Report',
    ACCESS_CONTROL: 'Procedure',
    OTHER: 'Other',
  };
  return mapping[key] || 'Other';
}

export function transformControlDrawerSeeds() {
  const evidenceData = readJson('getEvidenceDataForDocumentPage.json');
  const mappedEvidence = readJson('getMappedEvidenceRequests.json');
  const controlsData = readJson('getControlsForControlPage.json');
  const risksData = readJson('getRiskSceneriosForRiskMappingControls.json');

  const byDocumentId = new Map();

  const evidenceNodes = evidenceData?.data?.organization?.evidenceRequestsPaginated?.edges || [];
  for (const edge of evidenceNodes) {
    const node = edge?.node;
    if (!node?.id || !node?.title) continue;

    byDocumentId.set(node.id, {
      externalId: node.id,
      title: node.title,
      description: '',
      category: mapEvidenceCategory(node.category),
      status: mapEvidenceStatus(node.uploadStatus),
      validUntil: node.renewalData?.nextDate || null,
      tags: (node.standardsInfo || []).map((item) => normalizeFrameworkCode(item.standard)).filter(Boolean),
      controlIdentifiers: [],
    });
  }

  const monitorNodes = mappedEvidence?.data?.organization?.monitors?.edges || [];
  for (const edge of monitorNodes) {
    const node = edge?.node;
    if (!node?.id || !node?.title) continue;

    const existing = byDocumentId.get(node.id) || {
      externalId: node.id,
      title: node.title,
      description: node.description || '',
      category: 'Other',
      status: 'PENDING',
      validUntil: null,
      tags: [],
      controlIdentifiers: [],
    };

    const controls = (node.controls || []).map((c) => c?.id).filter(Boolean);
    existing.description = existing.description || node.description || '';
    existing.controlIdentifiers = Array.from(new Set([...(existing.controlIdentifiers || []), ...controls]));
    byDocumentId.set(node.id, existing);
  }

  const documents = Array.from(byDocumentId.values());

  const controlCatalog = [];
  const controlNodes = controlsData?.data?.organization?.controls?.edges || [];
  for (const edge of controlNodes) {
    const node = edge?.node;
    if (!node?.id) continue;
    controlCatalog.push({
      identifier: node.id,
      title: node.name || '',
      shorthandName: node.shorthandName || '',
    });
  }

  const riskMappings = [];
  const riskNodes = risksData?.data?.organization?.riskScenariosPaginated?.edges || [];
  for (const edge of riskNodes) {
    const node = edge?.node;
    if (!node?.description) continue;
    const controlIdentifiers = (node.linkedControls || []).map((c) => c?.id).filter(Boolean);
    riskMappings.push({
      title: node.description,
      controlIdentifiers: Array.from(new Set(controlIdentifiers)),
    });
  }

  const frameworkMappings = [];
  for (const edge of controlNodes) {
    const node = edge?.node;
    const controlIdentifier = node?.id;
    if (!controlIdentifier) continue;

    for (const standardSection of node.standardSections || []) {
      const frameworkCode = normalizeFrameworkCode(standardSection?.standard);
      for (const section of standardSection?.populatedSections || []) {
        const apolloId = section?.apolloId || '';
        const requirementIdentifier = section?.id || apolloId.split('-').slice(1).join('-');
        if (!requirementIdentifier) continue;

        frameworkMappings.push({
          controlIdentifier,
          controlTitle: node.name || '',
          frameworkCode,
          requirementIdentifier,
          requirementApolloId: apolloId || null,
        });
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'seeding-from-network-tab',
    controlCatalog,
    documents,
    riskMappings,
    frameworkMappings,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  return {
    controls: controlCatalog.length,
    documents: documents.length,
    riskMappings: riskMappings.length,
    frameworkMappings: frameworkMappings.length,
    outputFile: OUTPUT_FILE,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = transformControlDrawerSeeds();
  console.log('✅ Control drawer network data transformed');
  console.log(`   Controls: ${result.controls}`);
  console.log(`   Documents: ${result.documents}`);
  console.log(`   Risk mappings: ${result.riskMappings}`);
  console.log(`   Framework mappings: ${result.frameworkMappings}`);
  console.log(`   Output: ${result.outputFile}`);
}