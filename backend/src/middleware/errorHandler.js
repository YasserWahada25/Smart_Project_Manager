const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/** Converts any thrown error into an ApiError with a safe, client-facing message. */
function toApiError(err) {
  if (err instanceof ApiError) return err;

  // Malformed JSON body (express.json)
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body');
  }

  // Request body above the configured size limit (express.json)
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  // Schema validation failure (Mongoose)
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details);
  }

  // Invalid ObjectId or type cast (Mongoose)
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for field "${err.path}"`);
  }

  // Unique index violation (MongoDB)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {});
    return ApiError.conflict('Duplicate value', fields.map((field) => ({ field, message: 'Already exists' })));
  }

  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
}

// Express identifies error-handling middleware by its 4 parameters.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = toApiError(err);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed:`, err);
  }

  const body = {
    error: {
      status: apiError.statusCode,
      code: apiError.code,
      message: apiError.message,
    },
  };
  if (apiError.details) body.error.details = apiError.details;

  res.status(apiError.statusCode).json(body);
}

module.exports = errorHandler;
