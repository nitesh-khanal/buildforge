const mongoose = require('mongoose');

// The 8 builder slots, in canonical order — reused by buildController.js and,
// from Phase 1 onward, by CommunityBuild.js so a published build's
// component structure never drifts from a saved build's.
const CATEGORY_KEYS = ['cpu', 'cpu-cooler', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];

const COMPATIBILITY_STATUSES = ['compatible', 'warning', 'error'];

// One field per builder slot — nulls allowed since a build can be partial.
const componentsSchema = new mongoose.Schema(
  {
    cpu: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    'cpu-cooler': { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    motherboard: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    ram: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    gpu: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    storage: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    psu: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { _id: false }
);

const buildSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'My Build' },
    components: { type: componentsSchema, default: () => ({}) },
    totalPrice: { type: Number, default: 0 },
    compatibilityStatus: {
      type: String,
      enum: COMPATIBILITY_STATUSES,
      default: 'error',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Build', buildSchema);
module.exports.componentsSchema = componentsSchema;
module.exports.CATEGORY_KEYS = CATEGORY_KEYS;
module.exports.COMPATIBILITY_STATUSES = COMPATIBILITY_STATUSES;
