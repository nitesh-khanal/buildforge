const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const {
  getCart,
  addItem,
  addCustomBuild,
  updateItemQuantity,
  removeItem,
  clearCart,
} = require('../controllers/cartController');

// optionalAuth: logged-in users get their user-linked cart; guests fall back
// to the x-session-id header (see cartController.getCartOwnerFilter).
router.use(optionalAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.post('/custom-build', addCustomBuild);
router.patch('/items/:itemId', updateItemQuantity);
router.delete('/items/:itemId', removeItem);
router.delete('/', clearCart);

module.exports = router;
