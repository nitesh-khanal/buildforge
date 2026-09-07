const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Snapshot fields so the cart still displays correctly even if the
    // product is edited/removed later, and so a "custom build" can be
    // added as a single cart line while retaining every component.
    name: String,
    image: String,
    price: Number,
    quantity: { type: Number, default: 1, min: 1 },
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
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    // Present for logged-in users. Guests use a sessionId stored client-side
    // (e.g. in localStorage) so browsing/cart works without an account.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

cartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);
