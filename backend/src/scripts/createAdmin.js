/**
 * Creates the initial ADMIN account from environment variables (backend/.env):
 *   ADMIN_EMAIL, ADMIN_PASSWORD (required), ADMIN_FIRST_NAME, ADMIN_LAST_NAME (optional).
 * Usage: npm run create-admin
 */
const { config, validateConfig } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const userService = require('../services/user.service');
const logger = require('../utils/logger');

async function main() {
  validateConfig();

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set (see backend/.env.example)');
  }

  await connectDatabase(config.mongodbUri);
  try {
    const { created, user } = await userService.createAdminAccount({
      firstName: ADMIN_FIRST_NAME || 'Platform',
      lastName: ADMIN_LAST_NAME || 'Administrator',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (created) {
      logger.info(`Admin account created: ${user.email}`);
      logger.info('You can now remove ADMIN_PASSWORD from backend/.env');
    } else {
      logger.info(`Admin account already exists: ${user.email} (active: ${user.isActive}) — nothing changed`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Failed to create admin account:', err.message);
    process.exit(1);
  });
