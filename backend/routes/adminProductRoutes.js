const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { handleProductImageUpload } = require('../middleware/upload');
const {
  listProducts,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  restoreProduct,
  uploadProductImage,
} = require('../controllers/adminProductController');

router.use(protect, authorize('admin'));

router.get('/', listProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/stock', updateStock);
router.patch('/:id/restore', restoreProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/image', handleProductImageUpload, uploadProductImage);

module.exports = router;
