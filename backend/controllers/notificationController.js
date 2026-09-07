const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

// Notification requires login (see models/Notification.js) — every route
// here sits behind `protect` (see routes/notificationRoutes.js).

// GET /api/notifications — paginated, newest first. Also returns the
// current unread count so the frontend bell badge and the list itself come
// from one request rather than two on first load.
const getNotifications = asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Number(req.query.limit) || 20);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort('-createdAt')
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({
    success: true,
    notifications,
    total,
    unreadCount,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
  });
});

// GET /api/notifications/unread-count — lightweight poll for the navbar
// badge without pulling the full list.
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ success: true, unreadCount });
});

// PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found.');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  res.json({ success: true, notification });
});

// PATCH /api/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  res.json({ success: true });
});

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
