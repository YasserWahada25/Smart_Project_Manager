const { matchedData } = require('express-validator');
const dashboardService = require('../services/dashboard.service');
const searchService = require('../services/search.service');

async function global(req, res) {
  res.json(await dashboardService.getDashboard(req.user));
}

async function project(req, res) {
  res.json(await dashboardService.getProjectDashboard(req.user, req.params.id));
}

async function search(req, res) {
  res.json(await searchService.search(req.user, matchedData(req, { locations: ['query'] })));
}

module.exports = { global, project, search };
