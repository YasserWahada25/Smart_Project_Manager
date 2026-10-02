const { matchedData } = require('express-validator');
const authService = require('../services/auth.service');

// matchedData() only returns validated fields, so unexpected fields (e.g. isActive) are ignored.

async function register(req, res) {
  const result = await authService.register(matchedData(req));
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(matchedData(req));
  res.json(result);
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
