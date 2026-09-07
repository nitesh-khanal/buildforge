const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const {
  getSimilar,
  getFrequentlyBought,
  getBuildCompletions,
  getForYou,
  getBuildAdvice,
} = require('../controllers/recommendationController');

// Public — recommendations should work for guests just like browsing and
// building do (same rule as products/builds).
router.get('/similar/:productId', getSimilar);
router.get('/frequently-bought/:productId', getFrequentlyBought);
router.post('/complete-build', getBuildCompletions);

// optionalAuth: personalizes for logged-in users, falls back to trending
// for guests — see getForYou.
router.get('/for-you', optionalAuth, getForYou);

// Optional Gemini-powered blurb; safe to call even when disabled.
router.post('/build-advice', getBuildAdvice);

module.exports = router;
