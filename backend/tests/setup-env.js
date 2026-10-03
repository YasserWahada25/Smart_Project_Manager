// Runs before every test file (jest.setupFiles), before any application module is loaded.
// dotenv never overrides variables that are already set, so these values win over backend/.env.
const crypto = require('crypto');

process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
// Minimum cost keeps password hashing fast in tests; production default is 12.
process.env.BCRYPT_SALT_ROUNDS = '4';
// The AI service is never reached in tests: `fetch` is mocked by the AI tests.
process.env.AI_SERVICE_URL = 'http://ai.test';
process.env.AI_SERVICE_TOKEN = crypto.randomBytes(32).toString('hex');
process.env.AI_TIMEOUT_MS = '5000';
