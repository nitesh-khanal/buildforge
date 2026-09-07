const CommunityBuild = require('../models/CommunityBuild');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');

// A report can only be *resolved* into one of these — 'pending' is the
// starting state, not a valid resolution outcome.
const RESOLVABLE_STATUSES = Report.REPORT_STATUSES.filter((s) => s !== 'pending');

// --- Community builds ------------------------------------------------

// GET /api/admin/community/builds?status=&category=&search=&page=&limit=
// Unlike the public feed, this sees every visibility/status — a moderator
// needs to find hidden and private builds too.
const listBuilds = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.visibility) filter.visibility = req.query.visibility;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [builds, total] = await Promise.all([
    CommunityBuild.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email'),
    CommunityBuild.countDocuments(filter),
  ]);

  res.json({ success: true, builds, total, page, pages: Math.ceil(total / limit) || 1 });
});

// PATCH /api/admin/community/builds/:id/hide  { reason? }
const hideBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  build.status = 'hidden';
  build.moderatedBy = req.user._id;
  build.moderatedAt = new Date();
  build.moderationReason = req.body.reason || '';
  await build.save();

  res.json({ success: true, build });
});

// PATCH /api/admin/community/builds/:id/unhide
const unhideBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  build.status = 'visible';
  build.moderatedBy = req.user._id;
  build.moderatedAt = new Date();
  build.moderationReason = '';
  await build.save();

  res.json({ success: true, build });
});

// --- Comments ----------------------------------------------------------

// GET /api/admin/community/comments?status=&communityBuild=&page=&limit=
const listComments = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.communityBuild) filter.communityBuild = req.query.communityBuild;

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('communityBuild', 'title'),
    Comment.countDocuments(filter),
  ]);

  res.json({ success: true, comments, total, page, pages: Math.ceil(total / limit) || 1 });
});

// PATCH /api/admin/community/comments/:id/hide  { reason? } — decrements
// the parent build's commentsCount since that counter reflects visible
// comments only (see CommunityBuild.js's counter-sync design note).
const hideComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found.');
  }

  const wasVisible = comment.status === 'visible';
  comment.status = 'hidden';
  comment.moderatedBy = req.user._id;
  comment.moderatedAt = new Date();
  comment.moderationReason = req.body.reason || '';
  await comment.save();

  if (wasVisible) {
    await CommunityBuild.findByIdAndUpdate(comment.communityBuild, { $inc: { commentsCount: -1 } });
  }

  res.json({ success: true, comment });
});

// PATCH /api/admin/community/comments/:id/unhide
const unhideComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found.');
  }

  const wasHidden = comment.status === 'hidden';
  comment.status = 'visible';
  comment.moderatedBy = req.user._id;
  comment.moderatedAt = new Date();
  comment.moderationReason = '';
  await comment.save();

  // Guard against the parent build having been deleted (cascade-deletes
  // its comments, so this shouldn't normally happen, but an unhide is
  // cheap insurance against a dangling reference either way).
  if (wasHidden) {
    const parentExists = await CommunityBuild.exists({ _id: comment.communityBuild });
    if (parentExists) {
      await CommunityBuild.findByIdAndUpdate(comment.communityBuild, { $inc: { commentsCount: 1 } });
    }
  }

  res.json({ success: true, comment });
});

// --- Reports -------------------------------------------------------------

// GET /api/admin/community/reports?status=&targetType=&page=&limit= —
// defaults to the moderation queue order (pending first, oldest first),
// matching Report.js's `{ status: 1, createdAt: 1 }` index.
const listReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.targetType) filter.targetType = req.query.targetType;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ status: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name email'),
    Report.countDocuments(filter),
  ]);

  res.json({ success: true, reports, total, page, pages: Math.ceil(total / limit) || 1 });
});

// PATCH /api/admin/community/reports/:id/resolve  { status, resolutionNotes? }
// This only records the moderator's decision on the *report* — taking an
// actual action against the reported build/comment (hide it) is a separate
// call to the endpoints above. Kept decoupled rather than auto-hiding on
// `status: 'actioned'`, since a report can be actioned by e.g. warning the
// user without hiding the content at all.
const resolveReport = asyncHandler(async (req, res) => {
  const { status, resolutionNotes } = req.body;
  if (!status || !RESOLVABLE_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: ${RESOLVABLE_STATUSES.join(', ')}.`);
  }

  const report = await Report.findById(req.params.id);
  if (!report) {
    res.status(404);
    throw new Error('Report not found.');
  }

  report.status = status;
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  report.resolutionNotes = resolutionNotes || '';
  await report.save();

  res.json({ success: true, report });
});

module.exports = {
  listBuilds,
  hideBuild,
  unhideBuild,
  listComments,
  hideComment,
  unhideComment,
  listReports,
  resolveReport,
};
