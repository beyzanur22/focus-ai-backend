const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, is_admin: user.is_admin },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  });
}

// Refresh token'ı DB'de hash'li saklamak için
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, hashToken };
