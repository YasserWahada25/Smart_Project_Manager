const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs express-validator rules, then rejects the request with a 400 listing the first
 * error of each invalid field. Controllers read the sanitized input with matchedData(req).
 */
function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();

      const details = result.array({ onlyFirstError: true }).map((err) => ({ field: err.path, message: err.msg }));
      next(ApiError.badRequest('Validation failed', details));
    },
  ];
}

module.exports = validate;
