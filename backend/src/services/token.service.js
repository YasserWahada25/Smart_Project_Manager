const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const ALGORITHM = 'HS256';

/**
 * Signs an access token. `sub` identifies the user; `role` is informational for the
 * frontend only — the backend always re-reads the role from MongoDB (see authenticate).
 */
function signAccessToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
    algorithm: ALGORITHM,
  });
}

/** Throws a jsonwebtoken error (TokenExpiredError, JsonWebTokenError) when the token is not valid. */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signAccessToken, verifyAccessToken };
