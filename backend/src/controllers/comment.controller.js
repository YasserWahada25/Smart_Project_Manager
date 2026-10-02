const { matchedData } = require('express-validator');
const commentService = require('../services/comment.service');

async function listByTask(req, res) {
  res.json(await commentService.listComments(req.user, req.params.id, matchedData(req, { locations: ['query'] })));
}

async function create(req, res) {
  const { content } = matchedData(req, { locations: ['body'] });
  const comment = await commentService.addComment(req.user, req.params.id, content);
  res.status(201).json({ comment });
}

async function update(req, res) {
  const { content } = matchedData(req, { locations: ['body'] });
  const comment = await commentService.updateComment(req.user, req.params.id, content);
  res.json({ comment });
}

async function remove(req, res) {
  await commentService.deleteComment(req.user, req.params.id);
  res.status(204).end();
}

module.exports = { listByTask, create, update, remove };
