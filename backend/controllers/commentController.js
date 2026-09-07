const Comment = require('../models/Comment');
const CommunityBuild = require('../models/CommunityBuild');
const asyncHandler = require('../utils/asyncHandler');
const { validateCommentInput } = require('../validators/communityValidator');
const { canView } = require('./communityBuildController');

// GET /api/community/builds/:id/comments?page=&limit=
const getComments = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = { communityBuild: build._id, status: 'visible' };
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name'),
    Comment.countDocuments(filter),
  ]);

  res.json({ success: true, comments, total, page, pages: Math.ceil(total / limit) || 1 });
});

// POST /api/community/builds/:id/comments  { text }
const createComment = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  const errors = validateCommentInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const comment = await Comment.create({
    user: req.user._id,
    communityBuild: build._id,
    text: req.body.text.trim(),
  });
  await CommunityBuild.findByIdAndUpdate(build._id, { $inc: { commentsCount: 1 } });

  await comment.populate('user', 'name');
  res.status(201).json({ success: true, comment });
});

// PUT /api/community/builds/:id/comments/:commentId  { text } — edits the
// caller's own comment.
const updateComment = asyncHandler(async (req, res) => {
  const errors = validateCommentInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const comment = await Comment.findOne({ _id: req.params.commentId, communityBuild: req.params.id });
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found.');
  }
  if (comment.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only edit your own comment.');
  }

  comment.text = req.body.text.trim();
  comment.isEdited = true;
  await comment.save();
  await comment.populate('user', 'name');

  res.json({ success: true, comment });
});

// DELETE /api/community/builds/:id/comments/:commentId — a real delete (the
// author removing their own comment), not the admin `status: 'hidden'`
// moderation path — same distinction reviewController.deleteReview draws.
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.commentId, communityBuild: req.params.id });
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found.');
  }
  if (comment.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only delete your own comment.');
  }

  const wasVisible = comment.status === 'visible';
  await comment.deleteOne();
  if (wasVisible) {
    await CommunityBuild.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: -1 } });
  }

  res.json({ success: true, message: 'Comment deleted.' });
});

module.exports = { getComments, createComment, updateComment, deleteComment };
