const aiClient = require('../services/aiClient.service');

async function getStatus(req, res) {
  res.json(await aiClient.getStatus());
}

module.exports = { getStatus };
