const mongoose = require('mongoose');

// Phase 1 foundation for Phase 4 (Saved Addresses).
//
// Deliberately a separate collection rather than an array field on User:
// User already has a single embedded `address` subdocument (untouched here,
// so nothing about the existing profile-update flow changes) used as a
// simple checkout default today. A real "address book" — add, edit, delete,
// set default, pick one at checkout — needs each address to be its own
// document with its own _id so the Phase 4 controller can target one entry
// without reading/rewriting an array on every change.
//
// Field shape intentionally mirrors Order.shippingAddress so the Phase 4
// "use this saved address at checkout" flow is a straight copy, not a
// remapping.
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Optional friendly label ("Home", "Office") shown in the address list —
    // purely cosmetic, never used for matching/lookup.
    label: { type: String, trim: true, default: '' },

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'Nepal' },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1, isDefault: 1 });

// Enforces "at most one default address per user" at the data layer. Runs
// after save (rather than a pre-save hook) because unsetting every *other*
// address needs this document's own _id, which only exists once it's been
// saved. The Phase 4 controller can still call this directly after any
// write that changes `isDefault` — it's idempotent and safe to call
// whenever, not just from this hook.
addressSchema.post('save', async function (doc) {
  if (!doc.isDefault) return;
  await mongoose.model('Address').updateMany(
    { user: doc.user, _id: { $ne: doc._id } },
    { $set: { isDefault: false } }
  );
});

module.exports = mongoose.model('Address', addressSchema);
