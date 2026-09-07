const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  getRelatedProducts,
  getFeaturedProducts,
  getSearchSuggestions,
  getWorksWith,
} = require('../controllers/productController');

router.get('/featured', getFeaturedProducts);
router.get('/search/suggestions', getSearchSuggestions);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/:id/related', getRelatedProducts);
router.get('/:id/works-with', getWorksWith);

module.exports = router;
