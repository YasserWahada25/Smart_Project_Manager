const { config, validateConfig } = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { createApp } = require('./app');
const logger = require('./utils/logger');

const SHUTDOWN_TIMEOUT_MS = 10000;

async function start() {
  validateConfig();
  await connectDatabase(config.mongodbUri);

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Backend listening on port ${config.port} (${config.nodeEnv})`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('Failed to start backend:', err.message);
  process.exit(1);
});
