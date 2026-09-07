const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  esewaSuccessCallback,
  esewaFailureCallback,
  checkEsewaStatus,
} = require('../controllers/orderController');

// eSewa's redirect callbacks hit these directly from the customer's
// browser after leaving our site — there's no JWT to send. They're
// authenticated instead via the HMAC signature eSewa attaches to the
// payload (see esewaService.verifySignature), so these must stay outside
// the `protect` gate below.
router.get('/esewa/success', esewaSuccessCallback);
router.get('/esewa/failure', esewaFailureCallback);

// All other order routes require authentication (business rule #2: login
// is mandatory for checkout and order history).
router.use(protect);

router.post('/', createOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrderById);
router.patch('/:id/cancel', cancelMyOrder);
router.get('/:id/esewa-status', checkEsewaStatus);

module.exports = router;
