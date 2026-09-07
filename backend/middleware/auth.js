const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

// Verifies JWT (from Authorization header or cookie) and attaches req.user.
// Required for checkout, order history, account actions, and admin routes.
const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error('Please log in to continue.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401);
      throw new Error('User no longer exists.');
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Session expired or invalid. Please log in again.');
  }
});

// Like `protect`, but doesn't fail if there's no token — used for routes
// that behave differently for guests vs logged-in users (e.g. cart lookup).
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (err) {
      // Invalid/expired token on an optional route — just proceed as guest.
    }
  }
  next();
});

// Restricts a route to one or more roles, e.g. authorize('admin').
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error('You are not authorized to perform this action.');
  }
  next();
};

module.exports = { protect, optionalAuth, authorize };
