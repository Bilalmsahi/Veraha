/**
 * Integration Summary Service
 * Aggregates connection status and counts for the integrations hub.
 */
import AwsAccount from '../models/AwsAccount.js';
import AwsFinding from '../models/AwsFinding.js';
import HrProfile from '../models/HrProfile.js';
import Device from '../models/Device.js';
import IntegrationConnection from '../models/IntegrationConnection.js';

const getConnectionStatus = (connection) => connection?.status ?? 'not_connected';

const getFirstConnectionStatus = (connections) => {
  for (const connection of connections) {
    if (connection) {
      return connection.status;
    }
  }
  return 'not_connected';
};

/**
 * Get integrations hub summary for an organization
 * @param {String} organizationId - Organization ObjectId
 * @returns {Promise<Object>} Summary data for AWS, HR, and MDM integrations
 */
export const getSummary = async (organizationId) => {
  const [
    awsConnection,
    bamboohrConnection,
    ripplingConnection,
    jamfConnection,
    kandjiConnection,
    intuneConnection,
    jumpcloudConnection,
    accountCount,
    openFindingsCount,
    profileCount,
    activeCount,
    departedCount,
    deviceCount,
    compliantCount,
    nonCompliantCount,
    needsReviewCount,
  ] = await Promise.all([
    IntegrationConnection.findOne({ organizationId, integrationType: 'aws' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'bamboohr' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'rippling' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'jamf' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'kandji' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'intune' }),
    IntegrationConnection.findOne({ organizationId, integrationType: 'jumpcloud' }),
    AwsAccount.countDocuments({ organizationId, isDeleted: false }),
    AwsFinding.countDocuments({ organizationId, status: 'open', isDeleted: false }),
    HrProfile.countDocuments({ organizationId, isDeleted: false }),
    HrProfile.countDocuments({ organizationId, employmentStatus: 'active', isDeleted: false }),
    HrProfile.countDocuments({ organizationId, employmentStatus: 'departed', isDeleted: false }),
    Device.countDocuments({ organizationId, isDeleted: false }),
    Device.countDocuments({ organizationId, isDeleted: false, overallComplianceStatus: 'compliant' }),
    Device.countDocuments({ organizationId, isDeleted: false, overallComplianceStatus: 'non_compliant' }),
    Device.countDocuments({ organizationId, isDeleted: false, overallComplianceStatus: 'needs_review' }),
  ]);

  return {
    aws: {
      connectionStatus: getConnectionStatus(awsConnection),
      accountCount,
      openFindingsCount,
    },
    hr: {
      connectionStatus: getFirstConnectionStatus([bamboohrConnection, ripplingConnection]),
      profileCount,
      activeCount,
      departedCount,
    },
    mdm: {
      connectionStatus: getFirstConnectionStatus([
        jamfConnection,
        kandjiConnection,
        intuneConnection,
        jumpcloudConnection,
      ]),
      deviceCount,
      compliantCount,
      nonCompliantCount,
      needsReviewCount,
    },
  };
};

export default {
  getSummary,
};
