const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password
const PASSWORD_MAX_BYTES = 72;

/**
 * Single source of truth for password rules (registration, admin bootstrap…).
 * Returns the first rule the password breaks, or null when it is acceptable.
 */
function getPasswordPolicyError(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must contain at least one letter';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one digit';
  }
  return null;
}

module.exports = { getPasswordPolicyError };
