const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { handleCategoryImageUpload } = require('../middleware/upload');
const { listCategories, updateCategory, uploadCategoryImage } = require('../controllers/adminCategoryController');

router.use(protect, authorize('admin'));

router.get('/', listCategories);
router.put('/:slug', updateCategory);
// Phase 11 — real upload replacing the plain URL/path text input.
router.post('/:slug/image', handleCategoryImageUpload, uploadCategoryImage);

module.exports = router;
