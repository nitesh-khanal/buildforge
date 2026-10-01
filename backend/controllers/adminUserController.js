const pagination = require('../utils/pagination');
const User = require('../models/User');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/users — search by name/email, filter by role, paginated.
const listUsers = asyncHandler(async (req, res) => {
  const { role, search, page, limit } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  const { page: pageNum, limit: pageSize, skip } = pagination({ page, limit });

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(pageSize),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: users.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    users,
  });
});

// GET /api/admin/users/:id — profile plus a quick order-history summary,
// since "how much has this customer spent / ordered" is the first thing
// support usually wants when looking someone up.
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }

  const [orders, orderCount, spending] = await Promise.all([
    Order.find({ user: user._id }).sort('-createdAt').limit(20),
    Order.countDocuments({ user: user._id }),
    Order.aggregate([
      { $match: { user: user._id, paymentStatus: { $in: ['Paid', 'COD'] } } },
      { $group: { _id: null, totalSpent: { $sum: '$total' } } },
    ]),
  ]);
  const totalSpent = spending[0]?.totalSpent || 0;

  res.json({ success: true, user, orderCount, totalSpent, recentOrders: orders });
});

// PATCH /api/admin/users/:id/role — promote/demote between customer/admin.
// An admin can't demote their own account — that's how you end up with
// zero admins left and nobody who can undo it.
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['customer', 'admin'].includes(role)) {
    res.status(400);
    throw new Error('role must be "customer" or "admin".');
  }

  if (req.params.id === req.user._id.toString() && role !== req.user.role) {
    res.status(400);
    throw new Error('You cannot change your own role.');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }

  user.role = role;
  await user.save();
  res.json({ success: true, user });
});

// DELETE /api/admin/users/:id — guards against deleting yourself or the
// last remaining admin account, same reasoning as the role guard above.
const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot delete your own account.');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }

  if (user.role === 'admin') {
    const otherAdmins = await User.countDocuments({ role: 'admin', _id: { $ne: user._id } });
    if (otherAdmins === 0) {
      res.status(400);
      throw new Error('Cannot delete the last remaining admin account.');
    }
  }

  await user.deleteOne();
  res.json({ success: true, message: 'User deleted.' });
});

module.exports = { listUsers, getUser, updateUserRole, deleteUser };
