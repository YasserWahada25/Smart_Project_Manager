const { getPasswordPolicyError } = require('../src/validators/password.policy');

describe('password policy', () => {
  it('accepts a password with at least 8 characters, a letter and a digit', () => {
    expect(getPasswordPolicyError('Secret123')).toBeNull();
  });

  it.each([
    [undefined, 'Password is required'],
    ['', 'Password is required'],
    [12345678, 'Password is required'],
    ['abc1', 'Password must be at least 8 characters'],
    [`a1${'x'.repeat(71)}`, 'Password must be at most 72 bytes'],
    // 25 three-byte characters = 75 bytes although only 27 characters long
    [`a1${'€'.repeat(25)}`, 'Password must be at most 72 bytes'],
    ['Password', 'Password must contain at least one digit'],
    ['12345678', 'Password must contain at least one letter'],
  ])('rejects %p', (password, message) => {
    expect(getPasswordPolicyError(password)).toBe(message);
  });
});
