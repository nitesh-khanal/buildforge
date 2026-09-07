const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const { apiLimiter } = require('./middleware/rateLimiters');

const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const buildRoutes = require('./routes/buildRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminProductRoutes = require('./routes/adminProductRoutes');
const adminOrderRoutes = require('./routes/adminOrderRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminReviewRoutes = require('./routes/adminReviewRoutes');
const compareRoutes = require('./routes/compareRoutes');
const addressRoutes = require('./routes/addressRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const couponRoutes = require('./routes/couponRoutes');
const adminCouponRoutes = require('./routes/adminCouponRoutes');
const communityRoutes = require('./routes/communityRoutes');
const adminCommunityRoutes = require('./routes/adminCommunityRoutes');
const adminCategoryRoutes = require('./routes/adminCategoryRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Phase 11: only meaningful when actually deployed behind a real reverse
// proxy/load balancer — blindly trusting X-Forwarded-For otherwise lets a
// client spoof its own IP and dodge both rate limiters below. Off unless
// explicitly opted into via env var, same off-by-default spirit as the
// email/WhatsApp/Gemini integrations.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
// Phase 11: an explicit body-size cap — previously unbounded, so a single
// request with a huge JSON payload (e.g. an oversized `specifications`/
// `compatibilityData` blob) could tie up the process with no limit at all.
// 200kb comfortably covers every real JSON payload in this app (actual
// binary uploads go through multer's own separate 5MB image-file limit in
// middleware/upload.js and middleware/categoryImageUpload.js, not this).
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'BuildForge API is running' }));

// Phase 11: general per-IP ceiling across the whole API — see
// middleware/rateLimiters.js's apiLimiter for why. Mounted after the health
// check (an uptime monitor hitting /api/health shouldn't count against it)
// but before every route below.
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
// compareRoutes (Phase 3) must be mounted before productRoutes: it adds a
// bare `/compare` path onto the same /api/products base, and productRoutes'
// `/:id` catch-all would otherwise match it first (see routes/compareRoutes.js).
app.use('/api/products', compareRoutes);
app.use('/api/products', productRoutes);
// reviewRoutes adds /:id/reviews* onto the same /api/products base — a
// second router mounted at the same path, not a merge into productRoutes.js
// (see routes/reviewRoutes.js for why). Safe to mount after productRoutes
// since /:id/reviews needs a second path segment that /:id alone won't match.
app.use('/api/products', reviewRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wishlist', wishlistRoutes);
// Phase 4: saved addresses (address book) and the in-app notification center.
app.use('/api/addresses', addressRoutes);
app.use('/api/notifications', notificationRoutes);
// Phase 5: coupon lookup/preview (customer-facing, login required — usage
// limits are tracked per-user).
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/builds', buildRoutes);
app.use('/api/recommendations', recommendationRoutes);
// This workflow's Phase 6: community builds/likes/comments/ratings/reports
// (not to be confused with the original 8-phase project's own "Phase 6 —
// Admin API" comment below, a pre-existing naming collision between the
// two phase sequences).
app.use('/api/community', communityRoutes);

// Admin API (Phase 6) — every route below requires an authenticated admin
// (see middleware/auth.js `authorize('admin')`, applied in each router).
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);
app.use('/api/admin/coupons', adminCouponRoutes);
app.use('/api/admin/community', adminCommunityRoutes);
// Phase 10: category display-metadata management (label/description/image/
// displayOrder/isActive) — see routes/adminCategoryRoutes.js and
// models/Category.js for why the fixed 8-category set itself isn't
// manageable here.
app.use('/api/admin/categories', adminCategoryRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
