const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const COLORS = {
  background: '0.055 0.102 0.102',
  panel: '0.082 0.161 0.161',
  panelAlt: '0.102 0.200 0.200',
  border: '0.235 0.322 0.318',
  text: '0.961 0.953 0.878',
  muted: '0.753 0.714 0.604',
  accent: '0.835 0.773 0.604',
  blue: '0.149 0.388 0.922',
};

function escapePdf(value = '') {
  return String(value)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function titleCase(value = '') {
  return String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatPercent(value = 0) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatDate(value) {
  if (!value) return 'All time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'All time';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatOptionalDate(value) {
  if (!value) return 'Not set';
  return formatDate(value);
}

function truncate(value, max = 48) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

class PdfDoc {
  constructor({ title, subtitle }) {
    this.title = title;
    this.subtitle = subtitle;
    this.pages = [];
    this.current = [];
    this.y = PAGE_HEIGHT - MARGIN;
    this.pageNumber = 0;
    this.addPage();
  }

  add(command) {
    this.current.push(command);
  }

  addPage() {
    if (this.current.length) this.pages.push(this.current.join('\n'));
    this.current = [];
    this.pageNumber += 1;
    this.y = PAGE_HEIGHT - MARGIN;
    this.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.background, true);
    this.rect(0, PAGE_HEIGHT - 86, PAGE_WIDTH, 86, COLORS.panel, true);
    this.text('Veraha Security', MARGIN, PAGE_HEIGHT - 40, 16, COLORS.accent, true);
    this.text(this.title, MARGIN, PAGE_HEIGHT - 62, 13, COLORS.text, true);
    this.text(this.subtitle, MARGIN, PAGE_HEIGHT - 78, 8, COLORS.muted);
    this.text(`Page ${this.pageNumber}`, PAGE_WIDTH - MARGIN - 46, 28, 8, COLORS.muted);
    this.y = PAGE_HEIGHT - 116;
  }

  ensure(height) {
    if (this.y - height < 62) {
      this.addPage();
      return true;
    }
    return false;
  }

  rect(x, y, width, height, color, fill = false) {
    this.add(`q ${color} ${fill ? 'rg' : 'RG'} ${x} ${y} ${width} ${height} re ${fill ? 'f' : 'S'} Q`);
  }

  line(x1, y1, x2, y2, color = COLORS.border) {
    this.add(`q ${color} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  }

  text(value, x, y, size = 10, color = COLORS.text, bold = false) {
    this.add(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  }

  section(title) {
    this.ensure(34);
    this.text(title, MARGIN, this.y, 13, COLORS.text, true);
    this.y -= 18;
  }

  filterPills(filters) {
    this.ensure(36);
    let x = MARGIN;
    for (const filter of filters) {
      const label = `${filter.label}: ${filter.value}`;
      const width = Math.min(180, 36 + label.length * 4.7);
      this.rect(x, this.y - 14, width, 22, COLORS.panelAlt, true);
      this.rect(x, this.y - 14, width, 22, COLORS.border);
      this.text(truncate(label, 36), x + 10, this.y - 7, 8, COLORS.muted);
      x += width + 8;
      if (x > PAGE_WIDTH - MARGIN - 120) {
        x = MARGIN;
        this.y -= 30;
      }
    }
    this.y -= 30;
  }

  metrics(metrics) {
    this.ensure(86);
    const gap = 10;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
    metrics.slice(0, 4).forEach((metric, index) => {
      const x = MARGIN + index * (width + gap);
      this.rect(x, this.y - 70, width, 70, COLORS.panel, true);
      this.rect(x, this.y - 70, width, 70, COLORS.border);
      this.text(metric.label, x + 12, this.y - 20, 8, COLORS.muted);
      this.text(metric.value, x + 12, this.y - 43, 18, COLORS.text, true);
      if (metric.helper) this.text(truncate(metric.helper, 28), x + 12, this.y - 60, 7, COLORS.muted);
    });
    this.y -= 92;
  }

  table(columns, rows) {
    const rowHeight = 24;
    const tableWidth = PAGE_WIDTH - MARGIN * 2;
    const drawHeader = () => {
      this.ensure(rowHeight + 8);
      this.rect(MARGIN, this.y - rowHeight, tableWidth, rowHeight, COLORS.panelAlt, true);
      let x = MARGIN + 8;
      columns.forEach((column) => {
        this.text(column.label, x, this.y - 16, 8, COLORS.text, true);
        x += column.width;
      });
      this.y -= rowHeight;
    };

    this.ensure(48);
    drawHeader();
    rows.forEach((row, index) => {
      if (this.y - rowHeight - 4 < 62) {
        this.addPage();
        drawHeader();
      }
      if (index % 2 === 0) this.rect(MARGIN, this.y - rowHeight, tableWidth, rowHeight, '0.070 0.136 0.136', true);
      this.line(MARGIN, this.y - rowHeight, MARGIN + tableWidth, this.y - rowHeight);
      let cellX = MARGIN + 8;
      columns.forEach((column) => {
        this.text(truncate(row[column.key] ?? '', column.max ?? 32), cellX, this.y - 16, 8, COLORS.text);
        cellX += column.width;
      });
      this.y -= rowHeight;
    });
    this.y -= 24;
  }

  finalize() {
    if (this.current.length) {
      this.pages.push(this.current.join('\n'));
      this.current = [];
    }
    return buildPdf(this.pages);
  }
}

function buildPdf(pageStreams) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  void catalogId;
  const pagesObjectIndex = objects.length;
  addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];

  for (const stream of pageStreams) {
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  objects[pagesObjectIndex] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function filterSummary(filters = {}) {
  const period =
    filters.startDate || filters.endDate
      ? `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`
      : filters.timeframe || 'All time';
  return [
    { label: 'Period', value: period },
    { label: 'Frameworks', value: filters.frameworks || 'All enabled' },
  ];
}

function compliancePdf(report, filters, organizationName) {
  const doc = new PdfDoc({
    title: 'Compliance Report',
    subtitle: `${organizationName} - ${formatDate(report.generatedAt)}`,
  });
  doc.filterPills(filterSummary(filters));
  doc.metrics([
    { label: 'Compliance', value: formatPercent(report.overall.compliancePercent), helper: 'Average framework readiness' },
    { label: 'Requirements', value: formatNumber(report.overall.totalRequirements), helper: `${formatNumber(report.overall.passingRequirements)} passing` },
    { label: 'Controls', value: formatNumber(report.overall.totalControls), helper: `${formatNumber(report.overall.passingControls)} passing` },
    { label: 'Policies', value: formatPercent(report.policyAcknowledgement.percentAcknowledged), helper: 'Acknowledged' },
  ]);
  doc.section('Framework Readiness');
  doc.table(
    [
      { key: 'code', label: 'Framework', width: 105, max: 18 },
      { key: 'name', label: 'Name', width: 190, max: 34 },
      { key: 'requirements', label: 'Requirements', width: 92, max: 16 },
      { key: 'passing', label: 'Passing', width: 76, max: 12 },
      { key: 'readiness', label: 'Readiness', width: 70, max: 12 },
    ],
    report.frameworkBreakdown.map((row) => ({
      code: row.code,
      name: row.name,
      requirements: formatNumber(row.totalRequirements ?? row.totalControls),
      passing: formatNumber(row.passingRequirements ?? row.passingControls),
      readiness: formatPercent(row.readinessScore ?? row.compliancePercent),
    })),
  );
  doc.section('Top Failing Controls');
  doc.table(
    [
      { key: 'control', label: 'Control', width: 140, max: 24 },
      { key: 'title', label: 'Title', width: 300, max: 54 },
      { key: 'status', label: 'Status', width: 86, max: 16 },
    ],
    report.topFailingControls.map((row) => ({
      control: row.controlId || 'Control',
      title: row.title,
      status: titleCase(row.status),
    })),
  );
  if (Array.isArray(report.controls)) {
    doc.section(`All Controls (${formatNumber(report.controls.length)})`);
    doc.table(
      [
        { key: 'control', label: 'Control', width: 72, max: 14 },
        { key: 'title', label: 'Title', width: 162, max: 28 },
        { key: 'status', label: 'Status', width: 68, max: 13 },
        { key: 'manual', label: 'Manual', width: 66, max: 13 },
        { key: 'frameworks', label: 'Frameworks', width: 90, max: 18 },
        { key: 'evidence', label: 'Evidence', width: 55, max: 10 },
      ],
      report.controls.map((row) => ({
        control: row.controlId || 'Control',
        title: row.title,
        status: titleCase(row.status),
        manual: titleCase(row.manualStatus),
        frameworks: row.frameworks,
        evidence: formatNumber(row.evidenceCount),
      })),
    );
  }
  if (Array.isArray(report.evidenceItems)) {
    doc.section(`Evidence Items (${formatNumber(report.evidenceItems.length)})`);
    doc.table(
      [
        { key: 'title', label: 'Evidence', width: 180, max: 32 },
        { key: 'status', label: 'Status', width: 70, max: 13 },
        { key: 'controls', label: 'Controls', width: 90, max: 18 },
        { key: 'uploadedBy', label: 'Uploaded By', width: 110, max: 20 },
        { key: 'validUntil', label: 'Valid Until', width: 62, max: 12 },
      ],
      report.evidenceItems.map((row) => ({
        title: row.title,
        status: titleCase(row.status),
        controls: row.linkedControls,
        uploadedBy: row.uploadedBy,
        validUntil: formatOptionalDate(row.validUntil),
      })),
    );
  }
  if (Array.isArray(report.policies)) {
    doc.section(`Policy Acknowledgement (${formatNumber(report.policies.length)})`);
    doc.table(
      [
        { key: 'title', label: 'Policy', width: 215, max: 38 },
        { key: 'status', label: 'Status', width: 70, max: 13 },
        { key: 'ack', label: 'Ack', width: 65, max: 10 },
        { key: 'owner', label: 'Owner', width: 100, max: 18 },
        { key: 'review', label: 'Review', width: 65, max: 12 },
      ],
      report.policies.map((row) => ({
        title: row.title,
        status: titleCase(row.workflowStatus || row.status),
        ack: formatPercent(row.acknowledgementRate),
        owner: row.ownerName,
        review: formatOptionalDate(row.nextReviewDue),
      })),
    );
  }
  return doc.finalize();
}

function personnelPdf(report, filters, organizationName) {
  const doc = new PdfDoc({ title: 'Personnel Report', subtitle: `${organizationName} - ${formatDate(report.generatedAt)}` });
  doc.filterPills(filterSummary(filters));
  doc.metrics([
    { label: 'Personnel', value: formatNumber(report.totalPersonnel), helper: 'Internal users' },
    { label: 'Tasks', value: formatPercent(report.taskCompletion.completionPercent), helper: `${formatNumber(report.taskCompletion.completeTasks)} complete` },
    { label: 'Training', value: formatNumber(report.trainingByModule.length), helper: 'Modules with attempts' },
    { label: 'Devices', value: formatNumber(Object.values(report.deviceReviewsByStatus || {}).reduce((sum, value) => sum + value, 0)), helper: 'Reviews' },
  ]);
  doc.section('People');
  doc.table(
    [
      { key: 'name', label: 'Name', width: 165, max: 30 },
      { key: 'email', label: 'Email', width: 185, max: 34 },
      { key: 'role', label: 'Role', width: 70, max: 12 },
      { key: 'completion', label: 'Complete', width: 85, max: 12 },
    ],
    report.people.map((row) => ({
      name: row.name,
      email: row.email,
      role: titleCase(row.role),
      completion: formatPercent(row.completionPercent),
    })),
  );
  doc.section('Training');
  doc.table(
    [
      { key: 'title', label: 'Module', width: 300, max: 54 },
      { key: 'attempts', label: 'Attempts', width: 80, max: 12 },
      { key: 'passed', label: 'Passed', width: 80, max: 12 },
      { key: 'passRate', label: 'Pass Rate', width: 80, max: 12 },
    ],
    report.trainingByModule.map((row) => ({
      title: row.title,
      attempts: formatNumber(row.attempts),
      passed: formatNumber(row.passed),
      passRate: formatPercent(row.passRate),
    })),
  );
  return doc.finalize();
}

function riskPdf(report, filters, organizationName) {
  const doc = new PdfDoc({ title: 'Risk Report', subtitle: `${organizationName} - ${formatDate(report.generatedAt)}` });
  doc.filterPills(filterSummary(filters));
  doc.metrics([
    { label: 'Open Risks', value: formatNumber(report.totalOpen), helper: 'Active register' },
    { label: 'High Residual', value: formatNumber(report.residualByBand?.High || report.residualByBand?.HIGH || 0), helper: 'Residual band' },
    { label: 'Treatments', value: formatNumber(Object.keys(report.byTreatment || {}).length), helper: 'Categories' },
    { label: 'Top Risks', value: formatNumber(report.topRisks.length), helper: 'Prioritized' },
  ]);
  doc.section('Top Risks');
  doc.table(
    [
      { key: 'title', label: 'Risk', width: 230, max: 42 },
      { key: 'status', label: 'Status', width: 78, max: 12 },
      { key: 'residual', label: 'Residual', width: 86, max: 14 },
      { key: 'treatment', label: 'Treatment', width: 86, max: 14 },
      { key: 'owner', label: 'Owner', width: 80, max: 14 },
    ],
    report.topRisks.map((row) => ({
      title: row.title,
      status: titleCase(row.status),
      residual: row.residualBand ? `${row.residualBand} ${row.residualScore ?? ''}` : 'Unscored',
      treatment: titleCase(row.treatmentType || 'Unset'),
      owner: row.ownerName || 'Unassigned',
    })),
  );
  return doc.finalize();
}

function vendorPdf(report, filters, organizationName) {
  const doc = new PdfDoc({ title: 'Vendor Report', subtitle: `${organizationName} - ${formatDate(report.generatedAt)}` });
  doc.filterPills(filterSummary(filters));
  doc.metrics([
    { label: 'Vendors', value: formatNumber(report.total || report.certificationCoverage.totalVendors), helper: 'Tracked third parties' },
    { label: 'Cert Coverage', value: formatPercent(report.certificationCoverage.coveragePercent), helper: `${formatNumber(report.certificationCoverage.vendorsWithCertifications)} certified` },
    { label: 'High Risk', value: formatNumber(report.highRiskVendors.length), helper: 'Critical or high' },
    { label: 'Cert Types', value: formatNumber(Object.keys(report.certificationCoverage.certificationsByName || {}).length), helper: 'Unique names' },
  ]);
  doc.section('High Risk Vendors');
  doc.table(
    [
      { key: 'name', label: 'Vendor', width: 220, max: 40 },
      { key: 'riskTier', label: 'Risk Tier', width: 95, max: 16 },
      { key: 'status', label: 'Status', width: 95, max: 16 },
      { key: 'category', label: 'Category', width: 130, max: 22 },
    ],
    report.highRiskVendors.map((row) => ({
      name: row.name,
      riskTier: titleCase(row.riskTier || 'Unscored'),
      status: titleCase(row.status || 'Unknown'),
      category: titleCase(row.category || 'Uncategorized'),
    })),
  );
  return doc.finalize();
}

export function renderReportPdf({ type, report, filters, organizationName = 'Organization' }) {
  if (type === 'compliance') return compliancePdf(report, filters, organizationName);
  if (type === 'personnel') return personnelPdf(report, filters, organizationName);
  if (type === 'risk') return riskPdf(report, filters, organizationName);
  if (type === 'vendor') return vendorPdf(report, filters, organizationName);
  const err = new Error('Unsupported report type');
  err.statusCode = 404;
  throw err;
}

export default { renderReportPdf };
