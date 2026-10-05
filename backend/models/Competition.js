const mongoose = require('mongoose');
const rewardSchema = new mongoose.Schema({
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  minOrderAmount: { type: Number, default: 0, min: 0 },
  maxDiscountAmount: { type: Number, default: null, min: 0 },
  validityDays: { type: Number, default: 30, min: 1, max: 365 },
}, { _id: false });
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 2000 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  rewards: { type: [rewardSchema], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  finalizedAt: { type: Date, default: null },
  revision: { type: Number, default: 0 },
  winners: [{ rank: Number, entry: mongoose.Schema.Types.ObjectId, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, title: String, likes: Number, coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' } }],
}, { timestamps: true });
schema.index({ finalizedAt: 1, endsAt: 1 });
schema.pre('validate', function(next) {
  if (!(this.endsAt > this.startsAt)) return next(new Error('End time must be after start time.'));
  if (this.rewards.length !== 3) return next(new Error('Set exactly three coupon rewards.'));
  if (this.rewards.some(r => (r.discountType === 'percentage' && r.discountValue > 100) || !Number.isInteger(r.validityDays))) return next(new Error('Invalid coupon reward.'));
  next();
});
module.exports = mongoose.model('Competition', schema);
