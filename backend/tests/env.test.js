const { validateConfig, parseNumber, parseList } = require('../src/config/env');

const validConfig = {
  mongodbUri: 'mongodb://localhost:27017/test',
  port: 3000,
  jwtSecret: 'x'.repeat(32),
  jwtExpiresIn: '1d',
  bcryptSaltRounds: 12,
  aiServiceUrl: 'http://localhost:8000',
  aiServiceToken: undefined,
  aiTimeoutMs: 90000,
};

describe('environment configuration', () => {
  describe('parseNumber', () => {
    it('returns the fallback when the value is not set', () => {
      expect(parseNumber(undefined, 3000)).toBe(3000);
      expect(parseNumber('', 3000)).toBe(3000);
    });

    it('parses a numeric value', () => {
      expect(parseNumber('8080', 3000)).toBe(8080);
    });
  });

  describe('parseList', () => {
    it('splits and trims a comma-separated list', () => {
      expect(parseList('http://a.com, http://b.com ,', [])).toEqual(['http://a.com', 'http://b.com']);
    });

    it('returns the fallback when the value is empty', () => {
      expect(parseList(undefined, ['x'])).toEqual(['x']);
    });
  });

  describe('validateConfig', () => {
    it('passes for a complete and valid configuration', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('accepts a missing AI_SERVICE_TOKEN (AI features "not configured") but not a short one', () => {
      expect(() => validateConfig({ ...validConfig, aiServiceToken: undefined })).not.toThrow();
      expect(() => validateConfig({ ...validConfig, aiServiceToken: 't'.repeat(32) })).not.toThrow();
      expect(() => validateConfig({ ...validConfig, aiServiceToken: 'short' })).toThrow(
        'AI_SERVICE_TOKEN must be at least 32 characters long',
      );
    });

    it('checks AI_SERVICE_URL and AI_TIMEOUT_MS', () => {
      expect(() => validateConfig({ ...validConfig, aiServiceUrl: 'ftp://ai' })).toThrow(
        'AI_SERVICE_URL must be an http(s) URL',
      );
      expect(() => validateConfig({ ...validConfig, aiTimeoutMs: 500 })).toThrow(
        'AI_TIMEOUT_MS must be an integer between 1000 and 300000',
      );
    });

    it('throws when MONGODB_URI is missing', () => {
      expect(() => validateConfig({ ...validConfig, mongodbUri: undefined })).toThrow(
        'Invalid configuration: MONGODB_URI is required',
      );
    });

    it.each(['abc', '0', '70000', '3000.5'])('throws for invalid PORT "%s"', (value) => {
      expect(() => validateConfig({ ...validConfig, port: parseNumber(value, 3000) })).toThrow(
        'PORT must be an integer between 1 and 65535',
      );
    });

    it('throws when JWT_SECRET is missing', () => {
      expect(() => validateConfig({ ...validConfig, jwtSecret: undefined })).toThrow('JWT_SECRET is required');
    });

    it('throws when JWT_SECRET is shorter than 32 characters', () => {
      expect(() => validateConfig({ ...validConfig, jwtSecret: 'too-short' })).toThrow(
        'JWT_SECRET must be at least 32 characters long',
      );
    });

    it.each(['1h', '7d', 3600])('accepts JWT_EXPIRES_IN %p', (value) => {
      expect(() => validateConfig({ ...validConfig, jwtExpiresIn: value })).not.toThrow();
    });

    it('throws for an invalid JWT_EXPIRES_IN', () => {
      expect(() => validateConfig({ ...validConfig, jwtExpiresIn: 'one day' })).toThrow(
        'JWT_EXPIRES_IN must be a number of seconds or a duration',
      );
    });

    it.each(['abc', '3', '16', '10.5'])('throws for invalid BCRYPT_SALT_ROUNDS "%s"', (value) => {
      expect(() => validateConfig({ ...validConfig, bcryptSaltRounds: parseNumber(value, 12) })).toThrow(
        'BCRYPT_SALT_ROUNDS must be an integer between 4 and 15',
      );
    });

    it('reports every problem at once', () => {
      expect(() => validateConfig({ ...validConfig, mongodbUri: '', port: Number('abc') })).toThrow(
        'Invalid configuration: MONGODB_URI is required; PORT must be an integer between 1 and 65535',
      );
    });
  });
});
