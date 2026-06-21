import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';

const mockAwsAccountFindOne = jest.fn();
const mockAwsAccountCreate = jest.fn();
const mockAwsAccountCountDocuments = jest.fn();

const mockAwsFindingFindOne = jest.fn();
const mockAwsFindingCreate = jest.fn();
const mockAwsFindingCountDocuments = jest.fn();
const mockAwsFindingAggregate = jest.fn();

jest.unstable_mockModule('../../models/AwsAccount.js', () => ({
  default: {
    findOne: mockAwsAccountFindOne,
    create: mockAwsAccountCreate,
    countDocuments: mockAwsAccountCountDocuments,
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/AwsFinding.js', () => ({
  default: {
    findOne: mockAwsFindingFindOne,
    create: mockAwsFindingCreate,
    countDocuments: mockAwsFindingCountDocuments,
    aggregate: mockAwsFindingAggregate,
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/Evidence.js', () => ({
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const {
  createAccount,
  deleteAccount,
  createFinding,
  updateFinding,
  getStats,
} = await import('../awsIntegration.service.js');

describe('awsIntegration.service', () => {
  const organizationId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();
  const findingId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('throws 400 if awsAccountId is not 12 digits', async () => {
      await expect(
        createAccount(organizationId, userId, { awsAccountId: '12345', name: 'Prod' }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'AWS Account ID must be exactly 12 digits',
      });

      expect(mockAwsAccountFindOne).not.toHaveBeenCalled();
      expect(mockAwsAccountCreate).not.toHaveBeenCalled();
    });

    it('throws 409 if account already exists in org', async () => {
      mockAwsAccountFindOne.mockResolvedValue({ _id: accountId, awsAccountId: '123456789012' });

      await expect(
        createAccount(organizationId, userId, { awsAccountId: '123456789012', name: 'Prod' }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'AWS account already exists in this organization',
      });

      expect(mockAwsAccountCreate).not.toHaveBeenCalled();
    });

    it('creates and returns account with organizationId and createdBy', async () => {
      mockAwsAccountFindOne.mockResolvedValue(null);
      const created = {
        _id: accountId,
        organizationId,
        createdBy: userId,
        awsAccountId: '123456789012',
        name: 'Production',
      };
      mockAwsAccountCreate.mockResolvedValue(created);

      const result = await createAccount(organizationId, userId, {
        awsAccountId: '123456789012',
        name: 'Production',
      });

      expect(mockAwsAccountCreate).toHaveBeenCalledWith({
        organizationId,
        createdBy: userId,
        awsAccountId: '123456789012',
        name: 'Production',
      });
      expect(result).toEqual(created);
    });
  });

  describe('deleteAccount', () => {
    it('throws 404 if account not found', async () => {
      mockAwsAccountFindOne.mockResolvedValue(null);

      await expect(deleteAccount(organizationId, accountId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'AWS account not found',
      });
    });

    it('throws 409 if findings exist for the account', async () => {
      mockAwsAccountFindOne.mockResolvedValue({ _id: accountId, isDeleted: false });
      mockAwsFindingCountDocuments.mockResolvedValue(3);

      await expect(deleteAccount(organizationId, accountId)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot delete account with existing findings. Delete all findings first.',
      });
    });

    it('soft-deletes account when no findings exist, returns { deleted: true }', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const account = {
        _id: accountId,
        isDeleted: false,
        deletedAt: undefined,
        save,
      };
      mockAwsAccountFindOne.mockResolvedValue(account);
      mockAwsFindingCountDocuments.mockResolvedValue(0);

      const result = await deleteAccount(organizationId, accountId);

      expect(account.isDeleted).toBe(true);
      expect(account.deletedAt).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('createFinding', () => {
    it('throws 404 if account not found', async () => {
      mockAwsAccountFindOne.mockResolvedValue(null);

      await expect(
        createFinding(organizationId, accountId, userId, { title: 'Open SG' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'AWS account not found',
      });

      expect(mockAwsFindingCreate).not.toHaveBeenCalled();
    });

    it('creates finding with organizationId and awsAccountId', async () => {
      mockAwsAccountFindOne.mockResolvedValue({ _id: accountId });
      const created = {
        _id: findingId,
        organizationId,
        awsAccountId: accountId,
        title: 'Open SG',
      };
      mockAwsFindingCreate.mockResolvedValue(created);

      const result = await createFinding(organizationId, accountId, userId, {
        title: 'Open SG',
        severity: 'high',
      });

      expect(mockAwsFindingCreate).toHaveBeenCalledWith({
        organizationId,
        awsAccountId: accountId,
        createdBy: userId,
        title: 'Open SG',
        severity: 'high',
      });
      expect(result).toEqual(created);
    });
  });

  describe('updateFinding', () => {
    it('auto-sets resolvedOn when status changes to resolved', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const finding = {
        _id: findingId,
        status: 'open',
        resolvedOn: null,
        save,
      };
      mockAwsFindingFindOne.mockResolvedValue(finding);

      await updateFinding(organizationId, findingId, { status: 'resolved' });

      expect(finding.status).toBe('resolved');
      expect(finding.resolvedOn).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalled();
    });

    it('clears resolvedOn when status changes away from resolved', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const finding = {
        _id: findingId,
        status: 'resolved',
        resolvedOn: new Date('2026-01-01'),
        save,
      };
      mockAwsFindingFindOne.mockResolvedValue(finding);

      await updateFinding(organizationId, findingId, { status: 'in_remediation' });

      expect(finding.status).toBe('in_remediation');
      expect(finding.resolvedOn).toBeNull();
      expect(save).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns totalAccounts, totalFindings, findingsByStatus, findingsBySeverity', async () => {
      mockAwsAccountCountDocuments.mockResolvedValue(2);
      mockAwsFindingCountDocuments.mockResolvedValue(4);
      mockAwsFindingAggregate
        .mockResolvedValueOnce([
          { _id: 'open', count: 2 },
          { _id: 'resolved', count: 1 },
        ])
        .mockResolvedValueOnce([
          { _id: 'high', count: 1 },
          { _id: 'medium', count: 2 },
        ]);

      const result = await getStats(organizationId);

      expect(mockAwsAccountCountDocuments).toHaveBeenCalledWith({
        organizationId,
        isDeleted: false,
      });
      expect(mockAwsFindingCountDocuments).toHaveBeenCalledWith({
        organizationId,
        isDeleted: false,
      });
      expect(result).toEqual({
        totalAccounts: 2,
        totalFindings: 4,
        findingsByStatus: {
          open: 2,
          in_remediation: 0,
          resolved: 1,
          accepted_risk: 0,
        },
        findingsBySeverity: {
          critical: 0,
          high: 1,
          medium: 2,
          low: 0,
          informational: 0,
        },
      });
    });
  });
});
