const { User } = require('../models/user.model');
const { verifyAccessToken } = require('../services/token.service');
const ApiError = require('../utils/ApiError');

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Requires a valid `Authorization: Bearer <JWT>` header. Loads the user from MongoDB on
 * every request so deactivation and role changes take effect immediately, then exposes
 * it as `req.user`.
 */
async function authenticate(req, res, next) {
  const match = BEARER_PATTERN.exec(req.get('Authorization') || '');
  if (!match) {
    throw ApiError.unauthorized('Authentication required');
  }

  let payload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Invalid token');
  }
  if (!user.isActive) {
    throw ApiError.unauthorized('Account is deactivated');
  }
  if (user.isTokenIssuedBeforePasswordChange(payload.iat)) {
    throw ApiError.unauthorized('Password has been changed, please log in again');
  }

  req.user = user;
  next();
}

module.exports = authenticate;
