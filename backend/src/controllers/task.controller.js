const { matchedData } = require('express-validator');
const taskService = require('../services/task.service');

const bodyData = (req) => matchedData(req, { locations: ['body'] });
const queryData = (req) => matchedData(req, { locations: ['query'] });

async function create(req, res) {
  const task = await taskService.createTask(req.user, req.params.id, bodyData(req));
  res.status(201).json({ task });
}

async function listByProject(req, res) {
  res.json(await taskService.listTasks(req.user, req.params.id, queryData(req)));
}

async function board(req, res) {
  res.json(await taskService.getBoard(req.user, req.params.id, queryData(req)));
}

async function listMine(req, res) {
  res.json(await taskService.listMyTasks(req.user, queryData(req)));
}

async function getById(req, res) {
  const task = await taskService.getTask(req.user, req.params.id);
  res.json({ task });
}

async function update(req, res) {
  const task = await taskService.updateTask(req.user, req.params.id, bodyData(req));
  res.json({ task });
}

async function changeStatus(req, res) {
  const task = await taskService.changeTaskStatus(req.user, req.params.id, bodyData(req));
  res.json({ task });
}

async function assign(req, res) {
  const { assigneeId } = bodyData(req);
  const task = await taskService.assignTask(req.user, req.params.id, assigneeId);
  res.json({ task });
}

async function remove(req, res) {
  await taskService.deleteTask(req.user, req.params.id);
  res.status(204).end();
}

module.exports = { create, listByProject, board, listMine, getById, update, changeStatus, assign, remove };
