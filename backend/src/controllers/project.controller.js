const { matchedData } = require('express-validator');
const projectService = require('../services/project.service');

async function create(req, res) {
  const project = await projectService.createProject(req.user, matchedData(req, { locations: ['body'] }));
  res.status(201).json({ project });
}

async function list(req, res) {
  const result = await projectService.listProjects(req.user, matchedData(req, { locations: ['query'] }));
  res.json(result);
}

async function getById(req, res) {
  const project = await projectService.getProject(req.user, req.params.id);
  res.json({ project });
}

async function update(req, res) {
  const project = await projectService.updateProject(req.user, req.params.id, matchedData(req, { locations: ['body'] }));
  res.json({ project });
}

async function remove(req, res) {
  await projectService.deleteProject(req.user, req.params.id);
  res.status(204).end();
}

async function addMember(req, res) {
  const { userId } = matchedData(req, { locations: ['body'] });
  const project = await projectService.addMember(req.user, req.params.id, userId);
  res.status(201).json({ project });
}

async function removeMember(req, res) {
  const project = await projectService.removeMember(req.user, req.params.id, req.params.userId);
  res.json({ project });
}

module.exports = { create, list, getById, update, remove, addMember, removeMember };
