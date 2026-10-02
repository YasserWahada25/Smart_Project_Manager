const { matchedData } = require('express-validator');
const userService = require('../services/user.service');

async function list(req, res) {
  const result = await userService.listUsers(matchedData(req, { locations: ['query'] }));
  res.json(result);
}

async function listDevelopers(req, res) {
  const result = await userService.listDevelopers(matchedData(req, { locations: ['query'] }));
  res.json(result);
}

async function getById(req, res) {
  const user = await userService.getUserById(req.params.id);
  res.json({ user });
}

async function updateStatus(req, res) {
  const { isActive } = matchedData(req, { locations: ['body'] });
  const user = await userService.updateUserStatus(req.user, req.params.id, isActive);
  res.json({ user });
}

async function updateRole(req, res) {
  const { role } = matchedData(req, { locations: ['body'] });
  const user = await userService.updateUserRole(req.user, req.params.id, role);
  res.json({ user });
}

module.exports = { list, listDevelopers, getById, updateStatus, updateRole };
