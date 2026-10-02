// Runs before every test file (jest.setupFiles), before any application module is loaded.
// dotenv never overrides variables that are already set, so these values win over backend/.env.
const crypto = require('crypto');

process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
// Minimum cost keeps password hashing fast in tests; production default is 12.
process.env.BCRYPT_SALT_ROUNDS = '4';
