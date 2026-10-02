const { body, param, query } = require('express-validator');
const { PAGINATION } = require('../utils/pagination');

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

const mongoIdParam = (name, label) => param(name).isMongoId().withMessage(`Invalid ${label} id`);

const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION.maxLimit })
    .withMessage(`limit must be an integer between 1 and ${PAGINATION.maxLimit}`)
    .toInt(),
];

const searchQueryRule = (name = 'search', max = 100) =>
  query(name)
    .optional()
    .isString()
    .withMessage(`${name} must be a string`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${name} must be at most ${max} characters`);

const enumQueryRule = (name, values) =>
  query(name)
    .optional()
    .isIn(values)
    .withMessage(`${name} must be one of: ${values.join(', ')}`);

/** Required (or optional, for PATCH) non-empty trimmed string. */
const textRule = (field, label, max, { optional = false } = {}) => {
  const chain = body(field)
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .bail()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);
  return optional ? chain.optional() : chain;
};

/** Optional string that may be empty ("" clears the value). */
const optionalTextRule = (field, label, max) =>
  body(field)
    .optional()
    .isString()
    .withMessage(`${label} must be a string`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

/**
 * ISO 8601 date (e.g. "2026-10-02") converted to a Date.
 * nullable: `null` is accepted and kept (used to clear an optional date).
 */
const dateRule = (field, label, { optional = false, nullable = false } = {}) => {
  const chain = body(field)
    .custom((value) => (nullable && value === null) || isIsoDate(value))
    .withMessage(`${label} must be a valid date (YYYY-MM-DD)`)
    .customSanitizer((value) => (value === null ? null : new Date(value)));
  return optional ? chain.optional() : chain;
};

/**
 * Array of short unique strings (technologies, required skills…). Validated as a whole
 * (one message for the field) and sanitized: items trimmed.
 */
const stringListRule = (field, label, { maxItems, maxLength }) =>
  body(field)
    .optional()
    .custom((values) => {
      if (!Array.isArray(values) || values.length > maxItems) {
        throw new Error(`${label} must be an array of at most ${maxItems} items`);
      }
      const seen = new Set();
      values.forEach((value) => {
        if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
          throw new Error(`Each item of ${label} must be a non-empty string of at most ${maxLength} characters`);
        }
        const key = value.trim().toLowerCase();
        if (seen.has(key)) throw new Error(`Duplicate value in ${label}: ${value.trim()}`);
        seen.add(key);
      });
      return true;
    })
    // Sanitizers also run when validation failed: only touch well-formed input.
    .customSanitizer((values) =>
      Array.isArray(values) ? values.map((value) => (typeof value === 'string' ? value.trim() : value)) : values,
    );

module.exports = {
  mongoIdParam,
  paginationRules,
  searchQueryRule,
  enumQueryRule,
  textRule,
  optionalTextRule,
  dateRule,
  stringListRule,
};
