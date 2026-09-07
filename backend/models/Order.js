const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    isCustomBuild: { type: Boolean, default: false },
    buildComponents: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        category: String,
        price: Number,
      },
    ],
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String },
  },
  { _id: false }
);

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'COD', 'Refunded'];

// Phase 9: a lightweight audit trail of orderStatus changes, so the
// frontend can render a delivery-tracking timeline instead of only ever
// showing the current status. `changedBy` distinguishes a customer's own
// self-service cancellation from an admin-driven status update, since both
// now write to this array.
const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, enum: ['system', 'customer', 'admin'], default: 'system' },
  },
  { _id: false }
);

// eSewa-specific details, only populated for paymentMethod: 'esewa'. The
// transaction_uuid we send eSewa is always the order's own orderId (already
// globally unique), so this mostly just tracks eSewa's own reference id and
// raw status for support/reconciliation purposes.
const esewaDetailsSchema = new mongoose.Schema(
  {
    refId: String,
    status: String, // eSewa's own status string, e.g. COMPLETE, PENDING, CANCELED
    verifiedAt: Date,
  },
  { _id: false }
);

// Tracks the Phase 5 notification side effects so a duplicate eSewa
// callback (or any retry) doesn't re-email the customer or re-ping the
// shipping partner. `shippingWhatsappLink` lets the frontend/admin render a
// "message shipping partner" button without recomputing it.
const notificationsSchema = new mongoose.Schema(
  {
    confirmationEmailSent: { type: Boolean, default: false },
    shippingPartnerEmailSent: { type: Boolean, default: false },
    shippingWhatsappLink: { type: String, default: null },
    notifiedAt: Date,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ['card', 'cod', 'esewa'], required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    // Phase 5: the coupon code actually applied, if any — kept even though
    // `discount` alone is enough to compute the total, so admins/support
    // can see *which* coupon a given order used (order detail, analytics).
    couponCode: { type: String, default: null },
    total: { type: Number, required: true },
    esewaDetails: { type: esewaDetailsSchema, default: undefined },
    notifications: { type: notificationsSchema, default: () => ({}) },
    // Phase 9 (Delivery): a plain estimate shown to the customer — there is
    // no real courier integration to pull a live ETA from (see
    // services/shippingNotificationService.js's own design note).
    estimatedDeliveryDate: { type: Date },
    statusHistory: { type: [statusHistoryEntrySchema], default: () => [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
