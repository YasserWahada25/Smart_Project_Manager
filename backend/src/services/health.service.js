const { getDatabaseStatus } = require('../config/database');

const SERVICE_NAME = 'smart-project-manager-backend';

/** Builds the health report. The service is healthy only when MongoDB is connected. */
function getHealthReport() {
  const databaseStatus = getDatabaseStatus();
  const healthy = databaseStatus === 'connected';

  return {
    healthy,
    report: {
      status: healthy ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: { status: databaseStatus },
    },
  };
}

module.exports = { getHealthReport };
