const express = require('express');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const MarketingEvent = require('../models/MarketingEvent');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.post('/events', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }), asyncHandler(async (req, res) => {
  const { type, product, source } = req.body || {};
  if (!['impression', 'click', 'conversion'].includes(type) ||
      !mongoose.isValidObjectId(product) ||
      !['home', 'shop', 'related', 'product'].includes(source)) {
    return res.status(400).json({ success: false, message: 'Invalid marketing event.' });
  }
  await MarketingEvent.create({ type, product, source });
  res.status(202).json({ success: true });
}));
module.exports = router;
