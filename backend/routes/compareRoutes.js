const express = require('express');
const router = express.Router();
const { compareProducts } = require('../controllers/compareController');

// Mounted at /api/products in app.js — but BEFORE productRoutes.js, unlike
// reviewRoutes.js (which only adds sub-paths like /:id/reviews and can
// safely mount after it). `/compare` is a bare single-segment path, so if
// productRoutes ran first its `router.get('/:id', getProductById)`
// catch-all would swallow the request (treating "compare" as an id) before
// this router ever got a chance. See app.js for the mount order.
router.get('/compare', compareProducts);

module.exports = router;
