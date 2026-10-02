const { body } = require('express-validator');
const { ROLES } = require('../models/user.model');
const { getPasswordPolicyError } = require('./password.policy');

// ADMIN accounts cannot be created through public registration.
const SELF_REGISTRATION_ROLES = [ROLES.DEVELOPER, ROLES.PROJECT_MANAGER];

const nameRule = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .bail()
    .isLength({ max: 50 })
    .withMessage(`${label} must be at most 50 characters`);

const emailRule = () =>
  body('email')
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Email is invalid')
    .bail()
    .isLength({ max: 254 })
    .withMessage('Email must be at most 254 characters')
    .toLowerCase();

const registerRules = [
  nameRule('firstName', 'First name'),
  nameRule('lastName', 'Last name'),
  emailRule(),
  body('password').custom((value) => {
    const error = getPasswordPolicyError(value);
    if (error) throw new Error(error);
    return true;
  }),
  body('role')
    .optional()
    .isIn(SELF_REGISTRATION_ROLES)
    .withMessage(`Role must be one of: ${SELF_REGISTRATION_ROLES.join(', ')}`),
];

const loginRules = [
  emailRule(),
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
];

module.exports = { registerRules, loginRules, nameRule, SELF_REGISTRATION_ROLES };
