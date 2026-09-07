const jwt = require('jsonwebtoken');

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Sets the JWT as an httpOnly cookie AND returns it in the JSON body, so the
// frontend can use either approach (cookie-based auth is more secure against
// XSS; some SPA setups prefer reading the token themselves).
function sendTokenResponse(res, statusCode, user) {
  const token = generateToken(user._id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({ success: true, token, user: user.toSafeObject() });
}

module.exports = { generateToken, sendTokenResponse };
