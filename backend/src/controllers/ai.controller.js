const { matchedData } = require('express-validator');
const aiClient = require('../services/aiClient.service');
const aiAssistantService = require('../services/aiAssistant.service');
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

/** AI-04: one manager message → the assistant's reply and the proposed changes (nothing applied). */
async function assistantChat(req, res) {
  res.json(await aiAssistantService.chat(req.user, req.params.id, matchedData(req, { locations: ['body'] })));
}

/** AI-04: a proposal confirmed by the manager, applied with the usual rules. */
async function assistantAction(req, res) {
  res.status(201).json(await aiAssistantService.executeAction(req.user, req.params.id, req.body));
}

/** AI-04: the saved conversation of the manager with the assistant of the project. */
async function assistantConversation(req, res) {
  res.json(await aiAssistantService.getConversation(req.user, req.params.id));
}

async function clearAssistantConversation(req, res) {
  await aiAssistantService.clearConversation(req.user, req.params.id);
  res.status(204).end();
}

async function dismissAssistantProposal(req, res) {
  res.json(await aiAssistantService.dismissProposal(req.user, req.params.id, req.params.proposalId));
}

module.exports = {
  getStatus,
  recommendDevelopers,
  sprintRisk,
  assistantChat,
  assistantAction,
  assistantConversation,
  clearAssistantConversation,
  dismissAssistantProposal,
};
