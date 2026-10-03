const { matchedData } = require('express-validator');
const access = require('../services/projectAccess.service');
const aiPlanService = require('../services/aiPlan.service');

/**
 * Loads the project managed by the user (not archived) into req.project. Runs before the upload,
 * so that a file is only read for the manager of the project.
 */
async function loadManagedProject(req, res, next) {
  req.project = await access.findManagedProject(req.params.id, req.user);
  next();
}

async function generate(req, res) {
  const input = matchedData(req, { locations: ['body'] });
  const plan = await aiPlanService.generatePlan(req.project, { ...input, file: req.file });
  res.json({ plan });
}

async function apply(req, res) {
  const result = await aiPlanService.applyPlan(req.user, req.project, matchedData(req, { locations: ['body'] }));
  res.status(201).json(result);
}

module.exports = { loadManagedProject, generate, apply };
