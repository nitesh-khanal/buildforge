const Report = require('../models/Report');
const CommunityBuild = require('../models/CommunityBuild');
const Comment = require('../models/Comment');
const asyncHandler = require('../utils/asyncHandler');
const { validateReportInput } = require('../validators/communityValidator');

// Resolves a report target to confirm it actually exists before logging a
// report against it — a plain ObjectId (not a Mongoose refPath, see
// Report.js) so this lookup is done by hand rather than via `.populate()`.
async function targetExists(targetType, targetId) {
  if (targetType === 'communityBuild') return CommunityBuild.exists({ _id: targetId });
  if (targetType === 'comment') return Comment.exists({ _id: targetId });
  return false;
}

// POST /api/community/reports  { targetType, targetId, reason, details? }
// No dedupe against a user re-reporting the same target — the admin queue
// (adminCommunityController.listReports) is what a human triages, and
// repeat reports on one item are itself a signal worth seeing, not noise
// worth suppressing.
const createReport = asyncHandler(async (req, res) => {
  const errors = validateReportInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const exists = await targetExists(req.body.targetType, req.body.targetId);
  if (!exists) {
    res.status(404);
    throw new Error('The content you are trying to report no longer exists.');
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetType: req.body.targetType,
    targetId: req.body.targetId,
    reason: req.body.reason.trim(),
    details: req.body.details || '',
  });

  res.status(201).json({ success: true, report });
});

module.exports = { createReport };
