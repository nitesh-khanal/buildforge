// Wrap async route handlers so thrown errors go to Express's error middleware
// instead of crashing the process or requiring try/catch everywhere.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
