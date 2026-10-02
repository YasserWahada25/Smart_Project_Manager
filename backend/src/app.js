const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { config } = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const notificationService = require('./services/notification.service');

const API_PREFIX = '/api/v1';

/**
 * Builds the Express application without starting the HTTP server (used by server.js and tests).
 * @param {{ corsOrigins?: string[] }} [options] overrides of the environment configuration
 */
function createApp({ corsOrigins = config.corsOrigins } = {}) {
  const app = express();

  // Activity history → notifications (idempotent registration).
  notificationService.registerActivityListener();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.use(API_PREFIX, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, API_PREFIX };
