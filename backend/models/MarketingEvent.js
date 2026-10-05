const mongoose = require('mongoose');

const marketingEventSchema = new mongoose.Schema({
  type: { type: String, enum: ['impression', 'click', 'conversion'], required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  source: { type: String, enum: ['home', 'shop', 'related', 'product'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

marketingEventSchema.index({ createdAt: -1, type: 1 });
module.exports = mongoose.model('MarketingEvent', marketingEventSchema);
