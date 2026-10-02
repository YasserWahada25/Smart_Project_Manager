const mongoose = require('mongoose');
const logger = require('../utils/logger');

const DEFAULT_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
};

let listenersAttached = false;
let closingIntentionally = false;

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    if (!closingIntentionally) logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error:', err.message));
}

async function connectDatabase(uri, options = {}) {
  if (!uri) {
    throw new Error('A MongoDB connection URI is required');
  }
  await mongoose.connect(uri, { ...DEFAULT_OPTIONS, ...options });
  // Attached after the first successful connection so a failed startup only logs the startup error.
  attachConnectionListeners();
  logger.info(`MongoDB connected (database: ${mongoose.connection.name})`);
  return mongoose.connection;
}

async function disconnectDatabase() {
  closingIntentionally = true;
  try {
    await mongoose.disconnect();
  } finally {
    closingIntentionally = false;
  }
}

/** Returns the Mongoose connection state: connected, connecting, disconnecting or disconnected. */
function getDatabaseStatus() {
  return mongoose.STATES[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDatabase, disconnectDatabase, getDatabaseStatus };
