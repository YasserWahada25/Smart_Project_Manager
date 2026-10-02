const { matchedData } = require('express-validator');
const activityService = require('../services/activity.service');
const taskService = require('../services/task.service');

async function listByProject(req, res) {
  const query = matchedData(req, { locations: ['query'] });
  res.json(await activityService.listProjectActivities(req.user, req.params.id, query));
}

async function listByTask(req, res) {
  const query = matchedData(req, { locations: ['query'] });
  res.json(await taskService.listTaskActivities(req.user, req.params.id, query));
}

module.exports = { listByProject, listByTask };
