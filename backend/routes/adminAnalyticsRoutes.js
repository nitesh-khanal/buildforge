const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getOverview,
  getSalesOverTime,
  getTopProducts,
  getCategoryBreakdown,
} = require('../controllers/adminAnalyticsController');

router.use(protect, authorize('admin'));

router.get('/overview', getOverview);
router.get('/sales', getSalesOverTime);
router.get('/top-products', getTopProducts);
router.get('/category-breakdown', getCategoryBreakdown);

module.exports = router;
