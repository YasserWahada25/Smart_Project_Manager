const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('../../src/config/database');

let mongoServer;

/** Starts an in-memory MongoDB instance and connects Mongoose to it. */
async function startTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('smart_project_manager_test'));
}

async function stopTestDatabase() {
  await disconnectDatabase();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

/** Removes all documents (indexes are kept) so each test starts from an empty database. */
async function clearTestDatabase() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

module.exports = { startTestDatabase, stopTestDatabase, clearTestDatabase };
