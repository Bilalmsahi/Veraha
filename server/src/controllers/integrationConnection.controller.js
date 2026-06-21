/**
 * Integration Connection Controller
 * HTTP handlers for integration connection configuration
 */
import IntegrationConnection from '../models/IntegrationConnection.js';
import { sendSuccess } from '../middleware/responseHandler.js';
import { getSummary as fetchIntegrationSummary } from '../services/integrationSummary.service.js';

/**
 * GET /api/v1/integrations/connections
 * List all integration connections for the organization
 */
export const listConnections = async (req, res, next) => {
  try {
    const { organizationId } = req.user;

    const connections = await IntegrationConnection.find({
      organizationId,
      isDeleted: false,
    }).sort({ integrationType: 1 });

    sendSuccess(res, connections);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/integrations/connections
 * Create or update an integration connection
 */
export const upsertConnection = async (req, res, next) => {
  try {
    const { organizationId, _id: userId } = req.user;
    const { integrationType, status, displayName, metadata } = req.body;

    const connection = await IntegrationConnection.findOneAndUpdate(
      { organizationId, integrationType },
      {
        status,
        displayName,
        metadata,
        lastUpdatedAt: new Date(),
        configuredBy: userId,
      },
      { upsert: true, new: true }
    );

    sendSuccess(res, connection);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/integrations/connections/:type
 * Soft-delete an integration connection
 */
export const deleteConnection = async (req, res, next) => {
  try {
    const { organizationId } = req.user;

    const connection = await IntegrationConnection.findOne({
      organizationId,
      integrationType: req.params.type,
      isDeleted: false,
    });

    if (!connection) {
      const error = new Error('Integration connection not found');
      error.statusCode = 404;
      throw error;
    }

    connection.isDeleted = true;
    await connection.save();

    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    const summary = await fetchIntegrationSummary(req.user.organizationId);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
};

export default {
  listConnections,
  upsertConnection,
  deleteConnection,
  getSummary,
};
