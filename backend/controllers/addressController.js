const Address = require('../models/Address');
const asyncHandler = require('../utils/asyncHandler');

// Address requires login (see models/Address.js — a separate collection
// keyed on `user`, not a User.addresses[] array), so every route here sits
// behind `protect` (see routes/addressRoutes.js) and req.user is always
// present.

const EDITABLE_FIELDS = [
  'label',
  'fullName',
  'phone',
  'email',
  'address',
  'city',
  'province',
  'postalCode',
  'country',
  'isDefault',
];

function applyFields(doc, body) {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) doc[field] = body[field];
  }
}

// GET /api/addresses — default first, then most-recently-added.
const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, addresses });
});

// POST /api/addresses
const createAddress = asyncHandler(async (req, res) => {
  const { fullName, phone, address, city, province } = req.body;
  if (!fullName || !phone || !address || !city || !province) {
    res.status(400);
    throw new Error('Full name, phone, address, city and province are required.');
  }

  // A user's very first address becomes their default automatically —
  // otherwise nothing would ever be picked at checkout without an extra
  // "set default" step right after signing up.
  const existingCount = await Address.countDocuments({ user: req.user._id });
  const doc = new Address({ user: req.user._id });
  applyFields(doc, req.body);
  if (existingCount === 0) doc.isDefault = true;

  await doc.save(); // triggers the post('save') hook that unsets any other default
  res.status(201).json({ success: true, address: doc });
});

// PUT /api/addresses/:id
const updateAddress = asyncHandler(async (req, res) => {
  const doc = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) {
    res.status(404);
    throw new Error('Address not found.');
  }

  applyFields(doc, req.body);
  await doc.save();
  res.json({ success: true, address: doc });
});

// PATCH /api/addresses/:id/default
const setDefaultAddress = asyncHandler(async (req, res) => {
  const doc = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) {
    res.status(404);
    throw new Error('Address not found.');
  }

  doc.isDefault = true;
  await doc.save(); // hook unsets isDefault on every other address for this user
  res.json({ success: true, address: doc });
});

// DELETE /api/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const doc = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!doc) {
    res.status(404);
    throw new Error('Address not found.');
  }

  // If the deleted address was the default, promote the next most recent
  // one (if any) rather than leaving the user with no default at all.
  if (doc.isDefault) {
    const next = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.json({ success: true });
});

module.exports = { getAddresses, createAddress, updateAddress, setDefaultAddress, deleteAddress };
