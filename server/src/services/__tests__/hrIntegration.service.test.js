import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';

const mockHrProfileFindOne = jest.fn();
const mockHrProfileFindOneAndUpdate = jest.fn();

const mockUserFindOne = jest.fn();
const mockUserFind = jest.fn();

const mockPolicyAttestationCountDocuments = jest.fn();

const mockPolicyVersionFind = jest.fn();

const mockEvidenceFindOne = jest.fn();

const mockOffboardingEventCreate = jest.fn();

const mockSendNotificationEmail = jest.fn();

jest.unstable_mockModule('../../models/HrProfile.js', () => ({
  default: {
    findOne: mockHrProfileFindOne,
    findOneAndUpdate: mockHrProfileFindOneAndUpdate,
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: mockUserFindOne,
    find: mockUserFind,
  },
}));

jest.unstable_mockModule('../../models/PolicyAttestation.js', () => ({
  default: {
    countDocuments: mockPolicyAttestationCountDocuments,
  },
}));

jest.unstable_mockModule('../../models/PolicyVersion.js', () => ({
  default: {
    find: mockPolicyVersionFind,
  },
}));

jest.unstable_mockModule('../../models/Evidence.js', () => ({
  default: {
    findOne: mockEvidenceFindOne,
  },
}));

jest.unstable_mockModule('../../models/OffboardingEvent.js', () => ({
  default: {
    create: mockOffboardingEventCreate,
  },
}));

jest.unstable_mockModule('../emailService.js', () => ({
  default: {
    sendNotificationEmail: mockSendNotificationEmail,
  },
}));

jest.unstable_mockModule('../awsIntegration.service.js', () => ({
  createCompanionEvidence: jest.fn(),
}));

const {
  upsertProfile,
  importFromCSV,
  departEmployee,
  getPolicyStatus,
} = await import('../hrIntegration.service.js');

describe('hrIntegration.service', () => {
  const organizationId = new mongoose.Types.ObjectId();
  const importingUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const departedBy = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSendNotificationEmail.mockResolvedValue({ success: true });
    mockUserFind.mockReturnValue({
      then: (resolve) => resolve([]),
    });
  });

  describe('upsertProfile', () => {
    it('normalises workEmail to lowercase', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue(null);
      mockHrProfileFindOneAndUpdate.mockResolvedValue({
        _id: profileId,
        workEmail: 'jane@example.com',
      });

      await upsertProfile(organizationId, importingUserId, {
        fullName: 'Jane Doe',
        workEmail: '  Jane@Example.COM  ',
      });

      expect(mockHrProfileFindOneAndUpdate).toHaveBeenCalledWith(
        { organizationId, workEmail: 'jane@example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({ workEmail: 'jane@example.com' }),
        }),
        { upsert: true, new: true },
      );
    });

    it('sets userId when a matching User exists in the org', async () => {
      mockUserFindOne.mockResolvedValue({ _id: userId, email: 'jane@example.com' });
      mockHrProfileFindOne.mockResolvedValue(null);
      mockHrProfileFindOneAndUpdate.mockResolvedValue({
        _id: profileId,
        userId,
        workEmail: 'jane@example.com',
      });

      const { profile } = await upsertProfile(organizationId, importingUserId, {
        fullName: 'Jane Doe',
        workEmail: 'jane@example.com',
      });

      expect(mockHrProfileFindOneAndUpdate).toHaveBeenCalledWith(
        { organizationId, workEmail: 'jane@example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({ userId }),
        }),
        { upsert: true, new: true },
      );
      expect(profile.userId).toEqual(userId);
    });

    it('sets userId to null when no matching User found', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue(null);
      mockHrProfileFindOneAndUpdate.mockResolvedValue({
        _id: profileId,
        userId: null,
        workEmail: 'jane@example.com',
      });

      await upsertProfile(organizationId, importingUserId, {
        fullName: 'Jane Doe',
        workEmail: 'jane@example.com',
      });

      expect(mockHrProfileFindOneAndUpdate).toHaveBeenCalledWith(
        { organizationId, workEmail: 'jane@example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({ userId: null }),
        }),
        { upsert: true, new: true },
      );
    });

    it('returns { profile, created: true } for new insert', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue(null);
      const profile = { _id: profileId, workEmail: 'new@example.com' };
      mockHrProfileFindOneAndUpdate.mockResolvedValue(profile);

      const result = await upsertProfile(organizationId, importingUserId, {
        fullName: 'New Hire',
        workEmail: 'new@example.com',
      });

      expect(result).toEqual({ profile, created: true });
    });

    it('returns { profile, created: false } for existing update', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue({ _id: profileId });
      const profile = { _id: profileId, workEmail: 'existing@example.com' };
      mockHrProfileFindOneAndUpdate.mockResolvedValue(profile);

      const result = await upsertProfile(organizationId, importingUserId, {
        fullName: 'Existing Employee',
        workEmail: 'existing@example.com',
      });

      expect(result).toEqual({ profile, created: false });
    });
  });

  describe('importFromCSV', () => {
    it('skips rows missing fullName or workEmail', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue(null);
      mockHrProfileFindOneAndUpdate.mockResolvedValue({ _id: profileId });

      const result = await importFromCSV(
        organizationId,
        importingUserId,
        [
          { fullName: 'Jane Doe' },
          { workEmail: 'bob@example.com' },
          { fullName: 'Valid User', workEmail: 'valid@example.com' },
        ],
        'bamboohr',
      );

      expect(result.skipped).toBe(2);
      expect(result.imported).toBe(1);
      expect(result.errors).toEqual([
        { row: { fullName: 'Jane Doe' }, reason: 'Missing fullName or workEmail' },
        { row: { workEmail: 'bob@example.com' }, reason: 'Missing fullName or workEmail' },
      ]);
    });

    it('deduplicates by email within the batch', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne.mockResolvedValue(null);
      mockHrProfileFindOneAndUpdate.mockResolvedValue({ _id: profileId });

      const result = await importFromCSV(
        organizationId,
        importingUserId,
        [
          { fullName: 'Jane Doe', workEmail: 'jane@example.com' },
          { fullName: 'Jane Duplicate', workEmail: 'JANE@example.com' },
        ],
        'bamboohr',
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toEqual([
        {
          row: { fullName: 'Jane Duplicate', workEmail: 'JANE@example.com' },
          reason: 'Duplicate email in batch',
        },
      ]);
      expect(mockHrProfileFindOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('returns { imported, updated, skipped, errors }', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockHrProfileFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: profileId });
      mockHrProfileFindOneAndUpdate
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() })
        .mockResolvedValueOnce({ _id: profileId });

      const result = await importFromCSV(
        organizationId,
        importingUserId,
        [
          { fullName: 'New Hire', workEmail: 'new@example.com' },
          { fullName: 'Existing', workEmail: 'existing@example.com' },
        ],
        'bamboohr',
      );

      expect(result).toEqual({
        imported: 1,
        updated: 1,
        skipped: 0,
        errors: [],
      });
    });
  });

  describe('departEmployee', () => {
    it('throws 404 if profile not found', async () => {
      mockHrProfileFindOne.mockResolvedValue(null);

      await expect(
        departEmployee(organizationId, profileId, new Date(), departedBy),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'HR profile not found',
      });
    });

    it('sets employmentStatus to departed', async () => {
      const endDate = new Date('2026-05-01');
      const save = jest.fn().mockResolvedValue(undefined);
      const profile = {
        _id: profileId,
        fullName: 'Jane Doe',
        workEmail: 'jane@example.com',
        userId: null,
        employmentStatus: 'active',
        save,
      };
      mockHrProfileFindOne.mockResolvedValue(profile);

      const result = await departEmployee(organizationId, profileId, endDate, departedBy);

      expect(profile.employmentStatus).toBe('departed');
      expect(profile.endDate).toEqual(endDate);
      expect(save).toHaveBeenCalled();
      expect(result).toBe(profile);
    });

    it('creates OffboardingEvent when profile has userId', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const profile = {
        _id: profileId,
        fullName: 'Jane Doe',
        workEmail: 'jane@example.com',
        userId,
        employmentStatus: 'active',
        save,
      };
      mockHrProfileFindOne.mockResolvedValue(profile);
      mockOffboardingEventCreate.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      await departEmployee(organizationId, profileId, new Date('2026-05-01'), departedBy);

      expect(mockOffboardingEventCreate).toHaveBeenCalledWith({
        organizationId,
        userId,
        startedBy: departedBy,
        offboardingType: 'PERMANENT',
        status: 'OPEN',
        reason: 'Marked departed via HR integration',
      });
    });

    it('does NOT throw if OffboardingEvent creation fails', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const profile = {
        _id: profileId,
        fullName: 'Jane Doe',
        workEmail: 'jane@example.com',
        userId,
        employmentStatus: 'active',
        save,
      };
      mockHrProfileFindOne.mockResolvedValue(profile);
      mockOffboardingEventCreate.mockRejectedValue(new Error('duplicate key'));

      await expect(
        departEmployee(organizationId, profileId, new Date('2026-05-01'), departedBy),
      ).resolves.toBe(profile);

      expect(console.error).toHaveBeenCalledWith(
        '[hrIntegration] Failed to create OffboardingEvent:',
        'duplicate key',
      );
    });
  });

  describe('getPolicyStatus', () => {
    it('returns { unlinked: true } when profile has no userId', async () => {
      mockHrProfileFindOne.mockResolvedValue({
        _id: profileId,
        userId: null,
      });

      const result = await getPolicyStatus(organizationId, profileId);

      expect(result).toEqual({
        total: 0,
        acknowledged: 0,
        pending: 0,
        overdue: 0,
        unlinked: true,
      });
      expect(mockPolicyAttestationCountDocuments).not.toHaveBeenCalled();
    });

    it('returns policy counts for linked profiles against active policy versions', async () => {
      mockHrProfileFindOne.mockResolvedValue({
        _id: profileId,
        userId,
      });
      const versionId1 = new mongoose.Types.ObjectId();
      const versionId2 = new mongoose.Types.ObjectId();
      const versionId3 = new mongoose.Types.ObjectId();
      mockPolicyVersionFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue([
              { _id: versionId1, policyId: new mongoose.Types.ObjectId() },
              { _id: versionId2, policyId: new mongoose.Types.ObjectId() },
              { _id: versionId3, policyId: new mongoose.Types.ObjectId() },
            ]),
        }),
      });
      mockPolicyAttestationCountDocuments.mockResolvedValue(2);

      const result = await getPolicyStatus(organizationId, profileId);

      expect(mockPolicyVersionFind).toHaveBeenCalledWith({
        organizationId,
        status: 'ACTIVE',
      });
      expect(mockPolicyAttestationCountDocuments).toHaveBeenCalledWith({
        userId,
        policyVersionId: { $in: [versionId1, versionId2, versionId3] },
      });
      expect(result).toEqual({
        total: 3,
        acknowledged: 2,
        pending: 1,
        overdue: 0,
      });
    });

    it('returns zero counts when no active policy versions exist', async () => {
      mockHrProfileFindOne.mockResolvedValue({
        _id: profileId,
        userId,
      });
      mockPolicyVersionFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await getPolicyStatus(organizationId, profileId);

      expect(mockPolicyAttestationCountDocuments).not.toHaveBeenCalled();
      expect(result).toEqual({
        total: 0,
        acknowledged: 0,
        pending: 0,
        overdue: 0,
      });
    });
  });
});
