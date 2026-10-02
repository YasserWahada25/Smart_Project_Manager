const { matchedData } = require('express-validator');
const sprintService = require('../services/sprint.service');

async function create(req, res) {
  const sprint = await sprintService.createSprint(req.user, req.params.id, matchedData(req, { locations: ['body'] }));
  res.status(201).json({ sprint });
}

async function listByProject(req, res) {
  const result = await sprintService.listSprints(req.user, req.params.id, matchedData(req, { locations: ['query'] }));
  res.json(result);
}

async function getById(req, res) {
  const sprint = await sprintService.getSprint(req.user, req.params.id);
  res.json({ sprint });
}

async function update(req, res) {
  const sprint = await sprintService.updateSprint(req.user, req.params.id, matchedData(req, { locations: ['body'] }));
  res.json({ sprint });
}

async function changeStatus(req, res) {
  const { status } = matchedData(req, { locations: ['body'] });
  const sprint = await sprintService.changeSprintStatus(req.user, req.params.id, status);
  res.json({ sprint });
}

async function remove(req, res) {
  await sprintService.deleteSprint(req.user, req.params.id);
  res.status(204).end();
}

module.exports = { create, listByProject, getById, update, changeStatus, remove };
