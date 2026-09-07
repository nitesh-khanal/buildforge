const mongoose = require('mongoose');

// Phase 1 foundation for Phase 4 (Notifications). This is the in-app
// notification-center record — separate from (and in addition to) the
// existing best-effort email/WhatsApp side effects in
// orderNotificationService.js / shippingNotificationService.js, which are
// untouched by this model and keep working exactly as before.
const NOTIFICATION_TYPES = [
  'order_placed',
  'payment_successful',
  'payment_failed',
  'order_status_changed',
  'back_in_stock',
  'community_like',
  'community_comment',
  'build_copied',
  'review_activity',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Optional in-app route the frontend can navigate to on click, e.g.
    // "/orders/BF-20260904-00123" or "/community/build/<id>".
    link: { type: String, trim: true, default: '' },

    // Free-form payload for whatever the specific event needs (orderId,
    // productId, communityBuildId, actorUserId, ...) so new notification
    // types don't require a schema migration — kept intentionally generic
    // rather than a rigid per-type shape.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Powers the two queries the Phase 4 notification center actually needs:
// "this user's unread count" and "this user's notifications, newest first".
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
