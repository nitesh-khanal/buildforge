const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
} = require('../controllers/adminCouponController');

router.use(protect, authorize('admin'));

router.get('/', listCoupons);
router.post('/', createCoupon);
router.get('/:id', getCoupon);
router.put('/:id', updateCoupon);
router.patch('/:id/toggle', toggleCoupon);
router.delete('/:id', deleteCoupon);

module.exports = router;
