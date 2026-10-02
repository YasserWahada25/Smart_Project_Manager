const healthService = require('../services/health.service');

function getHealth(req, res) {
  const { healthy, report } = healthService.getHealthReport();
  res.status(healthy ? 200 : 503).json(report);
}

module.exports = { getHealth };
