const { User, ROLES } = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { getPasswordPolicyError } = require('../validators/password.policy');
const { PAGINATION, buildPagination } = require('../utils/pagination');
const { containsInsensitive, equalsInsensitive } = require('../utils/regex');

const DIRECTORY_FIELDS = 'firstName lastName email jobTitle skills';

/** Paginated user list, newest first. Filters: role, isActive, search (first name, last name or email). */
async function listUsers({
  page = PAGINATION.defaultPage,
  limit = PAGINATION.defaultLimit,
  role,
  isActive,
  search,
} = {}) {
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const pattern = containsInsensitive(search);
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { data: users, pagination: buildPagination(page, limit, total) };
}

/**
 * Directory of active developers, used by project managers to build their teams.
 * Only public profile fields are returned. Filters: search (name/email), skill (exact name, case-insensitive).
 */
async function listDevelopers({
  page = PAGINATION.defaultPage,
  limit = PAGINATION.defaultLimit,
  search,
  skill,
} = {}) {
  const filter = { role: ROLES.DEVELOPER, isActive: true };
  if (search) {
    const pattern = containsInsensitive(search);
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
  }
  if (skill) filter['skills.name'] = equalsInsensitive(skill);

  const [developers, total] = await Promise.all([
    User.find(filter)
      .select(DIRECTORY_FIELDS)
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { data: developers, pagination: buildPagination(page, limit, total) };
}

async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
}

/**
 * An administrator cannot change their own status or role: this guarantees that at
 * least one active ADMIN always remains (the one performing the change).
 */
function assertNotSelf(actor, targetId, action) {
  if (actor.id === targetId) {
    throw ApiError.forbidden(`Administrators cannot ${action} their own account`);
  }
}

async function updateUserStatus(actor, targetId, isActive) {
  assertNotSelf(actor, targetId, 'change the status of');
  const user = await getUserById(targetId);
  user.isActive = isActive;
  await user.save();
  return user;
}

async function updateUserRole(actor, targetId, role) {
  assertNotSelf(actor, targetId, 'change the role of');
  const user = await getUserById(targetId);
  user.role = role;
  await user.save();
  return user;
}

/**
 * Creates the initial ADMIN account (used by `npm run create-admin`).
 * Idempotent: if an ADMIN with this email already exists, nothing is changed.
 * @returns {{ created: boolean, user: object }}
 */
async function createAdminAccount({ firstName, lastName, email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      throw ApiError.conflict(`A non-admin user with the email ${normalizedEmail} already exists`);
    }
    return { created: false, user: existing };
  }

  const passwordError = getPasswordPolicyError(password);
  if (passwordError) {
    throw ApiError.badRequest(passwordError);
  }

  const user = await User.create({ firstName, lastName, email: normalizedEmail, password, role: ROLES.ADMIN });
  return { created: true, user };
}

module.exports = { listUsers, listDevelopers, getUserById, updateUserStatus, updateUserRole, createAdminAccount };
