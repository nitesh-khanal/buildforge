const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  publishBuild,
  listBuilds,
  getMyBuilds,
  getBuildById,
  updateBuild,
  deleteBuild,
  toggleLike,
  copyBuild,
} = require('../controllers/communityBuildController');
const { getComments, createComment, updateComment, deleteComment } = require('../controllers/commentController');
const { getRatings, rateBuild, deleteRating } = require('../controllers/buildRatingController');
const { createReport } = require('../controllers/reportController');

// Phase 6 — Community Backend. Nested under one router (rather than
// splitting builds/comments/ratings into separate files the way
// productRoutes/reviewRoutes do) since every sub-resource here hangs off
// the same :id param and reads more clearly kept together.

// Builds — /builds/mine must be registered before /builds/:id or Express
// would match "mine" as an :id.
router.get('/builds', optionalAuth, listBuilds);
router.get('/builds/mine', protect, getMyBuilds);
router.post('/builds', protect, publishBuild);
router.get('/builds/:id', optionalAuth, getBuildById);
router.put('/builds/:id', protect, updateBuild);
router.delete('/builds/:id', protect, deleteBuild);
router.post('/builds/:id/like', protect, toggleLike);
// Phase 8 — Community → PC Builder → Cart. optionalAuth: copying works for
// guests too, same as the builder itself (see copyBuild's own comment).
router.post('/builds/:id/copy', optionalAuth, copyBuild);

// Comments
router.get('/builds/:id/comments', optionalAuth, getComments);
router.post('/builds/:id/comments', protect, createComment);
router.put('/builds/:id/comments/:commentId', protect, updateComment);
router.delete('/builds/:id/comments/:commentId', protect, deleteComment);

// Ratings
router.get('/builds/:id/ratings', optionalAuth, getRatings);
router.post('/builds/:id/rating', protect, rateBuild);
router.delete('/builds/:id/rating', protect, deleteRating);

// Reports — not build-specific (a comment can be reported too), so it sits
// at the top level of this router rather than nested under /builds/:id.
router.post('/reports', protect, createReport);

module.exports = router;
