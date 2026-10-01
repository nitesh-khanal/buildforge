function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

// Central error handler — never leaks stack traces to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const errorStatus = Number(err.statusCode || err.status);
  if (Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus <= 599) statusCode = errorStatus;
  let message = err.message || 'Something went wrong. Please try again.';

  if (err.type === 'entity.parse.failed') { statusCode = 400; message = 'Invalid JSON request.'; }
  if (err.type === 'entity.too.large') { statusCode = 413; message = 'Request is too large.'; }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found.';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field ? field : 'Field'} already exists.`;
  }

  console.error(err.name, statusCode >= 500 ? 'Internal request error' : message);
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
