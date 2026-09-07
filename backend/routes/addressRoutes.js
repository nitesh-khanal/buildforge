const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} = require('../controllers/addressController');

// Address has no guest concept (see models/Address.js) — every route
// requires login, same convention as wishlistRoutes.js.
router.use(protect);

router.get('/', getAddresses);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.patch('/:id/default', setDefaultAddress);
router.delete('/:id', deleteAddress);

module.exports = router;
