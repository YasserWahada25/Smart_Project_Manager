const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load backend/.env (if present). Existing environment variables are never overridden.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const MIN_JWT_SECRET_LENGTH = 32;
const BCRYPT_ROUNDS_RANGE = { min: 4, max: 15 };
const MIN_AI_TOKEN_LENGTH = 32;
const AI_TIMEOUT_RANGE = { min: 1000, max: 300000 };

function isValidUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Returns the fallback when unset; otherwise a number, checked by validateConfig(). */
function parseNumber(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return Number(value);
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidJwtExpiresIn(expiresIn) {
  try {
    jwt.sign({}, 'expires-in-format-check', { expiresIn });
    return true;
  } catch {
    return false;
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: parseNumber(process.env.PORT, 3000),
  mongodbUri: process.env.MONGODB_URI,
  corsOrigins: parseList(process.env.CORS_ORIGIN, ['http://localhost:4200']),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 12),
  // AI service (FastAPI). Without a token the AI features report "not configured".
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiServiceToken: process.env.AI_SERVICE_TOKEN || undefined,
  aiTimeoutMs: parseNumber(process.env.AI_TIMEOUT_MS, 90000),
};

/**
 * Fails fast at startup when the configuration is incomplete or invalid.
 * Not called on import so the app can be loaded in tests without a database.
 */
function validateConfig(currentConfig = config) {
  const errors = [];
  if (!currentConfig.mongodbUri) {
    errors.push('MONGODB_URI is required');
  }
  if (!isValidPort(currentConfig.port)) {
    errors.push('PORT must be an integer between 1 and 65535');
  }
  if (!currentConfig.jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (currentConfig.jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }
  if (!isValidJwtExpiresIn(currentConfig.jwtExpiresIn)) {
    errors.push('JWT_EXPIRES_IN must be a number of seconds or a duration such as "1h" or "1d"');
  }
  const rounds = currentConfig.bcryptSaltRounds;
  if (!Number.isInteger(rounds) || rounds < BCRYPT_ROUNDS_RANGE.min || rounds > BCRYPT_ROUNDS_RANGE.max) {
    errors.push(`BCRYPT_SALT_ROUNDS must be an integer between ${BCRYPT_ROUNDS_RANGE.min} and ${BCRYPT_ROUNDS_RANGE.max}`);
  }
  if (currentConfig.aiServiceToken && currentConfig.aiServiceToken.length < MIN_AI_TOKEN_LENGTH) {
    errors.push(`AI_SERVICE_TOKEN must be at least ${MIN_AI_TOKEN_LENGTH} characters long`);
  }
  if (!isValidUrl(currentConfig.aiServiceUrl)) {
    errors.push('AI_SERVICE_URL must be an http(s) URL');
  }
  const timeout = currentConfig.aiTimeoutMs;
  if (!Number.isInteger(timeout) || timeout < AI_TIMEOUT_RANGE.min || timeout > AI_TIMEOUT_RANGE.max) {
    errors.push(`AI_TIMEOUT_MS must be an integer between ${AI_TIMEOUT_RANGE.min} and ${AI_TIMEOUT_RANGE.max}`);
  }
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join('; ')}`);
  }
}

module.exports = { config, validateConfig, parseNumber, parseList };
