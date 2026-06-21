import mongoose from 'mongoose';
import Group from '../models/Group.js';
import User from '../models/User.js';
import Policy from '../models/Policy.js';
import PersonnelTaskSet from '../models/PersonnelTaskSet.js';
import { sendSuccess } from '../middleware/responseHandler.js';

function notFound(message = 'Group not found') {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

async function validatePersonnelTaskSet(personnelTaskSetId, organizationId) {
  if (!personnelTaskSetId) return null;
  const exists = await PersonnelTaskSet.exists({
    _id: personnelTaskSetId,
    organizationId,
    isDeleted: { $ne: true },
    active: true,
  });
  if (!exists) {
    const err = new Error('Personnel task set not found');
    err.statusCode = 400;
    throw err;
  }
  return personnelTaskSetId;
}

export const listGroups = async (req, res, next) => {
  try {
    const { type, search } = req.validatedQuery ?? req.query;
    const query = { organizationId: req.user.organizationId, isDeleted: { $ne: true } };
    if (type) query.type = type;
    if (search) query.name = { $regex: String(search).trim(), $options: 'i' };

    const groups = await Group.find(query).sort({ name: 1 }).lean();
    const organizationObjectId = mongoose.Types.ObjectId.isValid(req.user.organizationId)
      ? new mongoose.Types.ObjectId(req.user.organizationId)
      : req.user.organizationId;
    const policyCounts = await Policy.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          isDeleted: { $ne: true },
          status: 'ACTIVE',
          assignmentGroupIds: { $in: groups.map((g) => g._id) },
        },
      },
      { $unwind: '$assignmentGroupIds' },
      { $group: { _id: '$assignmentGroupIds', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(policyCounts.map((row) => [String(row._id), row.count]));
    sendSuccess(
      res,
      groups.map((group) => ({
        ...group,
        activePolicyCount: countMap.get(String(group._id)) || 0,
      }))
    );
  } catch (err) {
    next(err);
  }
};

export const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
    }).lean();
    if (!group) throw notFound();
    sendSuccess(res, group);
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const userIds = req.body.memberUserIds || [];
    const users = userIds.length
      ? await User.find({
          organizationId: req.user.organizationId,
          isDeleted: { $ne: true },
          _id: { $in: userIds },
        })
          .select('_id')
          .lean()
      : [];
    await validatePersonnelTaskSet(req.body.personnelTaskSetId, req.user.organizationId);
    const group = await Group.create({
      organizationId: req.user.organizationId,
      ...req.body,
      memberUserIds: users.map((u) => u._id),
    });
    sendSuccess(res, group, null, 201);
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
    });
    if (!group) throw notFound();

    if (req.body.personnelTaskSetId !== undefined) {
      await validatePersonnelTaskSet(req.body.personnelTaskSetId, req.user.organizationId);
    }
    Object.assign(group, req.body);
    await group.save();
    sendSuccess(res, group);
  } catch (err) {
    next(err);
  }
};

export const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
    });
    if (!group) throw notFound();

    group.isDeleted = true;
    group.deletedAt = new Date();
    group.deletedBy = req.user._id;
    await group.save();
    sendSuccess(res, { deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
};

export const addMembers = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
    });
    if (!group) throw notFound();

    const userIds = req.body.userIds;
    const users = await User.find({
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
      _id: { $in: userIds },
    })
      .select('_id')
      .lean();

    const validIds = users.map((u) => u._id);
    group.memberUserIds = Array.from(new Set([...(group.memberUserIds || []), ...validIds].map(String))).map(
      (id) => id
    );
    await group.save();
    sendSuccess(res, group);
  } catch (err) {
    next(err);
  }
};

export const removeMembers = async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: { $ne: true },
    });
    if (!group) throw notFound();

    const removeSet = new Set(req.body.userIds.map(String));
    group.memberUserIds = (group.memberUserIds || []).filter((id) => !removeSet.has(String(id)));
    await group.save();
    sendSuccess(res, group);
  } catch (err) {
    next(err);
  }
};

export default {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMembers,
};

