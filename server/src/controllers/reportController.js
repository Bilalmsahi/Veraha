import reportService from '../services/reportService.js';
import reportPdfService from '../services/reportPdfService.js';
import Organization from '../models/Organization.js';
import { sendSuccess } from '../middleware/responseHandler.js';

const REPORT_BUILDERS = {
  compliance: (req) => reportService.getComplianceReport(req.user.organizationId, req.query),
  personnel: (req) => reportService.getPersonnelReport(req.user),
  risk: (req) => reportService.getRiskReport(req.user.organizationId),
  vendor: (req) => reportService.getVendorReport(req.user.organizationId),
};

const PDF_REPORT_BUILDERS = {
  ...REPORT_BUILDERS,
  compliance: (req) => reportService.getComplianceReport(req.user.organizationId, req.query, { detailLevel: 'export' }),
};

export const getComplianceReport = async (req, res, next) => {
  try {
    const result = await reportService.getComplianceReport(req.user.organizationId, req.query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getPersonnelReport = async (req, res, next) => {
  try {
    const result = await reportService.getPersonnelReport(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getRiskReport = async (req, res, next) => {
  try {
    const result = await reportService.getRiskReport(req.user.organizationId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getVendorReport = async (req, res, next) => {
  try {
    const result = await reportService.getVendorReport(req.user.organizationId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const exportReportPdf = async (req, res, next) => {
  try {
    const { type } = req.params;
    const buildReport = PDF_REPORT_BUILDERS[type];
    if (!buildReport) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }

    const report = await buildReport(req);
    const organization = await Organization.findById(req.user.organizationId).select('name').lean();
    const pdf = reportPdfService.renderReportPdf({
      type,
      report,
      filters: {
        timeframe: req.query.timeframe || report.filters?.timeframe || 'all',
        startDate: req.query.startDate || report.filters?.startDate || null,
        endDate: req.query.endDate || report.filters?.endDate || null,
        frameworks: req.query.frameworks || report.filters?.frameworks || null,
      },
      organizationName: organization?.name || 'Organization',
    });
    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline';
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
};

export default {
  getComplianceReport,
  getPersonnelReport,
  getRiskReport,
  getVendorReport,
  exportReportPdf,
};
