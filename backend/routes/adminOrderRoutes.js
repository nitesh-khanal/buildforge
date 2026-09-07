const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  listOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  sweepEsewaOrders,
} = require('../controllers/adminOrderController');

router.use(protect, authorize('admin'));

router.get('/', listOrders);
router.post('/sweep-esewa', sweepEsewaOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/payment-status', updatePaymentStatus);

module.exports = router;
