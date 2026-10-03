const aiClient = require('../services/aiClient.service');
const aiRecommendationService = require('../services/aiRecommendation.service');
const aiRiskService = require('../services/aiRisk.service');

async function getStatus(req, res) {
  res.json(await aiClient.getStatus());
}

/** AI-02: project members ranked for a task (manager of the project). */
async function recommendDevelopers(req, res) {
  res.json(await aiRecommendationService.recommendDevelopers(req.user, req.params.id));
}

/** AI-03: delay risk of a planned or active sprint (project viewers). */
async function sprintRisk(req, res) {
  res.json(await aiRiskService.predictSprintRisk(req.user, req.params.id));
}

module.exports = { getStatus, recommendDevelopers, sprintRisk };
