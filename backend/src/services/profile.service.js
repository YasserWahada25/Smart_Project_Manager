const { User } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { buildAuthResponse } = require('./auth.service');

const UPDATABLE_FIELDS = ['firstName', 'lastName', 'jobTitle', 'bio'];

/** Updates the profile of the authenticated user. Email, role and status cannot be changed here. */
async function updateProfile(user, updates) {
  const fields = UPDATABLE_FIELDS.filter((field) => updates[field] !== undefined);
  if (fields.length === 0) {
    throw ApiError.badRequest(`Provide at least one field to update: ${UPDATABLE_FIELDS.join(', ')}`);
  }

  fields.forEach((field) => {
    user[field] = updates[field];
  });
  await user.save();
  return user;
}

/**
 * Changes the password after checking the current one. Every token issued before the
 * change becomes invalid, so a fresh token is returned to keep the current session.
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    // 400 (not 401): the session is valid, only the submitted field is wrong.
    throw ApiError.badRequest('Validation failed', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  user.password = newPassword;
  await user.save();
  return buildAuthResponse(user);
}

/** Replaces the whole skill list (an empty array removes every skill). */
async function replaceSkills(user, skills) {
  user.skills = skills.map(({ name, level, yearsOfExperience }) => ({
    name: name.trim(),
    level,
    ...(yearsOfExperience !== undefined && { yearsOfExperience }),
  }));
  await user.save();
  return user;
}

module.exports = { updateProfile, changePassword, replaceSkills };
