import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/axios', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/api/axios';
import {
  getIntegrationSummary,
  listAwsAccounts,
  createAwsAccount,
  deleteAwsAccount,
  listFindings,
  createFinding,
  updateFinding,
  listHrProfiles,
  importHrCSV,
  departEmployee,
  getPolicyStatus,
} from '@/api/integrations';

const mockSummary = {
  aws: { connectionStatus: 'active', accountCount: 2, openFindingsCount: 5 },
  hr: { connectionStatus: 'active', profileCount: 10, activeCount: 8, departedCount: 2 },
  mdm: {
    connectionStatus: 'not_configured',
    deviceCount: 0,
    compliantCount: 0,
    nonCompliantCount: 0,
    needsReviewCount: 0,
  },
};

const mockAwsAccount = {
  _id: 'acc-1',
  name: 'Production',
  awsAccountId: '123456789012',
  regions: ['us-east-1'],
  status: 'active' as const,
  linkedControlIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockFinding = {
  _id: 'finding-1',
  awsAccountId: 'acc-1',
  title: 'Open S3 bucket',
  severity: 'high' as const,
  description: 'Bucket is publicly accessible',
  detectedOn: '2026-01-15T00:00:00.000Z',
  status: 'open' as const,
  linkedControlIds: [],
  createdAt: '2026-01-15T00:00:00.000Z',
};

const mockHrProfile = {
  _id: 'hr-1',
  fullName: 'Jane Doe',
  workEmail: 'jane@example.com',
  employmentStatus: 'active' as const,
  hrSource: 'manual' as const,
  backgroundCheckStatus: 'completed' as const,
  linkedControlIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockPolicyStatus = {
  total: 5,
  acknowledged: 3,
  pending: 1,
  overdue: 1,
};

describe('integrations API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getIntegrationSummary', () => {
    it('calls GET /integrations/summary and returns data', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: mockSummary, error: null } });

      const result = await getIntegrationSummary();

      expect(api.get).toHaveBeenCalledWith('/integrations/summary');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('listAwsAccounts', () => {
    it('calls GET /integrations/aws/accounts with params', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockAwsAccount], error: null, meta: { pagination: { page: 1 } } },
      });

      await listAwsAccounts({ search: 'prod', page: 1, limit: 10 });

      expect(api.get).toHaveBeenCalledWith('/integrations/aws/accounts?search=prod&page=1&limit=10');
    });

    it('returns { data, pagination } from response', async () => {
      const pagination = { page: 1, total: 1 };
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockAwsAccount], error: null, meta: { pagination } },
      });

      const result = await listAwsAccounts();

      expect(result).toEqual({ data: [mockAwsAccount], pagination });
    });
  });

  describe('createAwsAccount', () => {
    it('calls POST /integrations/aws/accounts with body', async () => {
      const body = { name: 'Staging', awsAccountId: '987654321098' };
      vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: mockAwsAccount, error: null } });

      const result = await createAwsAccount(body);

      expect(api.post).toHaveBeenCalledWith('/integrations/aws/accounts', body);
      expect(result).toEqual(mockAwsAccount);
    });
  });

  describe('deleteAwsAccount', () => {
    it('calls DELETE /integrations/aws/accounts/:id', async () => {
      vi.mocked(api.delete).mockResolvedValue({
        data: { success: true, data: { deleted: true }, error: null },
      });

      await deleteAwsAccount('acc-1');

      expect(api.delete).toHaveBeenCalledWith('/integrations/aws/accounts/acc-1');
    });
  });

  describe('listFindings', () => {
    it('calls GET /integrations/aws/accounts/:accountId/findings', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockFinding], error: null, meta: { pagination: {} } },
      });

      await listFindings('acc-1', { status: 'open', severity: 'high' });

      expect(api.get).toHaveBeenCalledWith(
        '/integrations/aws/accounts/acc-1/findings?status=open&severity=high'
      );
    });
  });

  describe('createFinding', () => {
    it('calls POST /integrations/aws/accounts/:accountId/findings with body', async () => {
      const body = { title: 'New finding', severity: 'medium', description: 'Details' };
      vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: mockFinding, error: null } });

      const result = await createFinding('acc-1', body);

      expect(api.post).toHaveBeenCalledWith('/integrations/aws/accounts/acc-1/findings', body);
      expect(result).toEqual(mockFinding);
    });
  });

  describe('updateFinding', () => {
    it('calls PATCH /integrations/aws/findings/:id', async () => {
      const body = { status: 'resolved' as const };
      const updatedFinding = { ...mockFinding, status: 'resolved' as const };
      vi.mocked(api.patch).mockResolvedValue({ data: { success: true, data: updatedFinding, error: null } });

      const result = await updateFinding('finding-1', body);

      expect(api.patch).toHaveBeenCalledWith('/integrations/aws/findings/finding-1', body);
      expect(result).toEqual(updatedFinding);
    });
  });

  describe('listHrProfiles', () => {
    it('calls GET /integrations/hr with params', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockHrProfile], error: null, meta: { pagination: {} } },
      });

      await listHrProfiles({ search: 'jane', status: 'active', page: 2 });

      expect(api.get).toHaveBeenCalledWith('/integrations/hr?search=jane&status=active&page=2');
    });
  });

  describe('importHrCSV', () => {
    it('calls POST /integrations/hr/import with rows and hrSource', async () => {
      const rows = [{ fullName: 'John Smith', workEmail: 'john@example.com' }];
      const importResult = { imported: 1, skipped: 0 };
      vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: importResult, error: null } });

      const result = await importHrCSV(rows, 'bamboohr_import');

      expect(api.post).toHaveBeenCalledWith('/integrations/hr/import', {
        rows,
        hrSource: 'bamboohr_import',
      });
      expect(result).toEqual(importResult);
    });
  });

  describe('departEmployee', () => {
    it('calls POST /integrations/hr/:id/depart', async () => {
      const departedProfile = { ...mockHrProfile, employmentStatus: 'departed' as const };
      vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: departedProfile, error: null } });

      const result = await departEmployee('hr-1', '2026-05-01');

      expect(api.post).toHaveBeenCalledWith('/integrations/hr/hr-1/depart', { endDate: '2026-05-01' });
      expect(result).toEqual(departedProfile);
    });
  });

  describe('getPolicyStatus', () => {
    it('calls GET /integrations/hr/policy-status/:id', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockPolicyStatus, error: null },
      });

      const result = await getPolicyStatus('hr-1');

      expect(api.get).toHaveBeenCalledWith('/integrations/hr/policy-status/hr-1');
      expect(result).toEqual(mockPolicyStatus);
    });
  });
});
