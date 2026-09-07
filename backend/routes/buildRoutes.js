const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  checkCompatibility,
  saveBuild,
  getMyBuilds,
  getBuildById,
  updateBuild,
  deleteBuild,
} = require('../controllers/buildController');

// Public — the builder and compatibility checking work without an account
// (spec section 3). Only *saving* a build requires login.
router.post('/check', checkCompatibility);

router.use(protect);
router.post('/', saveBuild);
router.get('/', getMyBuilds);
router.get('/:id', getBuildById);
router.put('/:id', updateBuild);
router.delete('/:id', deleteBuild);

module.exports = router;
