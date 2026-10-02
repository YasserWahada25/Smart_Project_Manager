const { body } = require('express-validator');
const { SKILL_LEVELS, PROFILE_LIMITS } = require('../models/user.model');
const { nameRule } = require('./auth.validator');
const { getPasswordPolicyError } = require('./password.policy');
const { optionalTextRule } = require('./common.validator');

const LEVELS = Object.values(SKILL_LEVELS);

const updateProfileRules = [
  nameRule('firstName', 'First name').optional(),
  nameRule('lastName', 'Last name').optional(),
  optionalTextRule('jobTitle', 'Job title', PROFILE_LIMITS.jobTitleMaxLength),
  optionalTextRule('bio', 'Bio', PROFILE_LIMITS.bioMaxLength),
];

const changePasswordRules = [
  body('currentPassword')
    .isString()
    .withMessage('Current password is required')
    .bail()
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword').custom((value, { req }) => {
    const error = getPasswordPolicyError(value);
    if (error) throw new Error(error.replace('Password', 'New password'));
    if (value === req.body.currentPassword) {
      throw new Error('New password must be different from the current password');
    }
    return true;
  }),
];

function findDuplicateSkillName(skills) {
  const seen = new Set();
  for (const skill of skills) {
    if (typeof skill?.name !== 'string') continue;
    const key = skill.name.trim().toLowerCase();
    if (seen.has(key)) return skill.name.trim();
    seen.add(key);
  }
  return null;
}

// Rules on array items ("skills.*.x") use a single validator each and no bail():
// with wildcards, bail() would stop the chain for every item, hiding other items' errors.
const replaceSkillsRules = [
  body('skills')
    .isArray({ max: PROFILE_LIMITS.maxSkills })
    .withMessage(`skills must be an array of at most ${PROFILE_LIMITS.maxSkills} items`)
    .bail()
    .custom((skills) => {
      const duplicate = findDuplicateSkillName(skills);
      if (duplicate) throw new Error(`Duplicate skill: ${duplicate}`);
      return true;
    }),
  body('skills.*.name')
    .custom((name) => typeof name === 'string' && name.trim().length > 0 && name.trim().length <= PROFILE_LIMITS.skillNameMaxLength)
    .withMessage(`Skill name is required (at most ${PROFILE_LIMITS.skillNameMaxLength} characters)`),
  body('skills.*.level')
    .isIn(LEVELS)
    .withMessage(`Skill level must be one of: ${LEVELS.join(', ')}`),
  body('skills.*.yearsOfExperience')
    .optional()
    .isInt({ min: 0, max: PROFILE_LIMITS.maxYearsOfExperience })
    .withMessage(`Years of experience must be an integer between 0 and ${PROFILE_LIMITS.maxYearsOfExperience}`)
    .toInt(),
];

module.exports = { updateProfileRules, changePasswordRules, replaceSkillsRules };
