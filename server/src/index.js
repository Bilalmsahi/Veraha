import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { mongoSanitize, xssSanitize } from './middleware/sanitize.js';
import Organization from './models/Organization.js';
import { autoUnsnoozeExpiredTests } from './services/testWorkflowService.js';
import { autoUnsnoozeExpiredPolicies } from './services/policyWorkflowService.js';
import { expireStaleInvitations } from './services/invitationService.js';
import { startEvidenceReminderJob } from './jobs/evidenceReminders.js';

// Import all models to register them with Mongoose
// This prevents lazy-loading issues in services
import './models/index.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import frameworkRoutes from './routes/frameworkRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import controlRoutes from './routes/controlRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import evidenceRoutes from './routes/evidenceRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import policyVersionRoutes from './routes/policyVersionRoutes.js';
import riskRoutes from './routes/riskRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import riskLibraryRoutes from './routes/riskLibraryRoutes.js';
import policyLibraryRoutes from './routes/policyLibraryRoutes.js';
import userRoutes from './routes/userRoutes.js';
import testRoutes from './routes/testRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import auditorRoutes from './routes/auditorRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import accessReviewRoutes from './routes/accessReviewRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import personnelTaskRoutes from './routes/personnelTaskRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import awsIntegrationRoutes from './routes/awsIntegration.routes.js';
import hrIntegrationRoutes from './routes/hrIntegration.routes.js';
import integrationConnectionRoutes from './routes/integrationConnection.routes.js';
import integrationHubRoutes from './routes/integrationHub.routes.js';
import adminRoutes from './admin/adminRoutes.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express v5 fix: Make req.query mutable for sanitization middleware
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// Security: Apply input sanitization
app.use(mongoSanitize);
app.use(xssSanitize);

// =============================================================================
// STATIC FILES (for local file storage mode)
// =============================================================================
// Serve uploaded files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
    error: null,
    meta: null,
  });
});

// =============================================================================
// API ROUTES
// =============================================================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/frameworks', frameworkRoutes);
app.use('/api/v1/requirements', requirementRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/organization', organizationRoutes);
app.use('/api/v1/controls', controlRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/policies', policyRoutes);
app.use('/api/v1/policy-versions', policyVersionRoutes);
app.use('/api/v1/risks', riskRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/risk-library', riskLibraryRoutes);
app.use('/api/v1/policy-library', policyLibraryRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/audits', auditRoutes);
app.use('/api/v1/auditor', auditorRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/access-reviews', accessReviewRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/personnel-tasks', personnelTaskRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/integrations/aws', awsIntegrationRoutes);
app.use('/api/v1/integrations/hr', hrIntegrationRoutes);
app.use('/api/v1/integrations/connections', integrationConnectionRoutes);
app.use('/api/v1/integrations', integrationHubRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/admin', adminRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================
// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// =============================================================================
// DATABASE CONNECTION & SERVER START
// =============================================================================
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/compliance-platform';

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');

    // Hourly workflow maintenance: auto-unsnooze expired tests and policies for all organizations.
    cron.schedule('0 * * * *', async () => {
      try {
        const organizations = await Organization.find({ isDeleted: { $ne: true } }).select('_id').lean();
        for (const org of organizations) {
          await autoUnsnoozeExpiredTests({ organizationId: org._id });
          await autoUnsnoozeExpiredPolicies({ organizationId: org._id });
        }
        await expireStaleInvitations();
      } catch (err) {
        console.error('[cron] hourly maintenance failed:', err);
      }
    });
    console.log('⏰ Registered hourly auto-unsnooze scheduler (tests + policies)');
    startEvidenceReminderJob();

    // Start server only after DB connection is established
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();
