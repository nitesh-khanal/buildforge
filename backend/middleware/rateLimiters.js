const rateLimit = require('express-rate-limit');

// Applies to login/register to slow down brute-force / credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again in a few minutes.',
  },
});

// Phase 11 — Security pass. Previously only the auth routes had any rate
// limiting at all; every other endpoint (search, cart mutations, coupon
// validation, the whole admin API, etc.) had no per-IP ceiling whatsoever.
// This is a deliberately generous general-purpose limiter (high enough that
// normal browsing/building/checkout traffic — including polling surfaces
// like `NotificationContext`'s 30s unread-count check — never comes close
// to it) meant to catch scraping/abuse/accidental-loop traffic, not to
// throttle real users. `authLimiter` above stays separately applied to
// login/register with its own, much tighter ceiling, since credential
// stuffing needs a stricter limit than general API abuse does.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

module.exports = { authLimiter, apiLimiter };
