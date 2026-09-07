const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  listBuilds,
  hideBuild,
  unhideBuild,
  listComments,
  hideComment,
  unhideComment,
  listReports,
  resolveReport,
} = require('../controllers/adminCommunityController');

router.use(protect, authorize('admin'));

router.get('/builds', listBuilds);
router.patch('/builds/:id/hide', hideBuild);
router.patch('/builds/:id/unhide', unhideBuild);

router.get('/comments', listComments);
router.patch('/comments/:id/hide', hideComment);
router.patch('/comments/:id/unhide', unhideComment);

router.get('/reports', listReports);
router.patch('/reports/:id/resolve', resolveReport);

module.exports = router;
