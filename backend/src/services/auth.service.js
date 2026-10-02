const bcrypt = require('bcrypt');
const { config } = require('../config/env');
const { User } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { signAccessToken } = require('./token.service');

let dummyHashPromise;

/**
 * Hash compared against when the email is unknown, so a login attempt takes about the
 * same time whether or not the account exists (prevents user enumeration by timing).
 */
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash('timing-attack-mitigation', config.bcryptSaltRounds);
  return dummyHashPromise;
}

function buildAuthResponse(user) {
  return {
    token: signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: config.jwtExpiresIn,
    user: user.toJSON(),
  };
}

async function register({ firstName, lastName, email, password, role }) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('Email is already registered', [{ field: 'email', message: 'Already exists' }]);
  }
  const user = await User.create({ firstName, lastName, email, password, role });
  return buildAuthResponse(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    await bcrypt.compare(password, await getDummyHash());
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Account is deactivated');
  }

  return buildAuthResponse(user);
}

module.exports = { register, login, buildAuthResponse };
