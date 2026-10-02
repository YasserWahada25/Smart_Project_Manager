import { testToken } from '../../testing/test-data';
import { decodeJwtPayload, isTokenExpired, tokenExpiresAt } from './jwt';

describe('jwt helpers', () => {
  it('decodes the payload of a token', () => {
    expect(decodeJwtPayload(testToken(60, { role: 'DEVELOPER' }))).toMatchObject({
      sub: 'u1',
      role: 'DEVELOPER',
    });
  });

  it.each(['', 'not-a-jwt', 'a.%%%.c', `a.${btoa('"just a string"')}.c`])(
    'returns null for an unreadable token %p',
    (token) => {
      expect(decodeJwtPayload(token)).toBeNull();
    },
  );

  it('computes the expiry date in milliseconds', () => {
    const token = testToken(60);
    const exp = decodeJwtPayload(token)?.exp as number;

    expect(tokenExpiresAt(token)).toBe(exp * 1000);
  });

  it('tells whether a token is expired', () => {
    expect(isTokenExpired(testToken(60))).toBe(false);
    expect(isTokenExpired(testToken(-1))).toBe(true);
    expect(isTokenExpired(testToken(60, { exp: undefined }))).toBe(false);
  });
});
