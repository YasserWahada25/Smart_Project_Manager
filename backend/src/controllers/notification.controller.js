const { matchedData } = require('express-validator');
const notificationService = require('../services/notification.service');

async function list(req, res) {
  res.json(await notificationService.listNotifications(req.user, matchedData(req, { locations: ['query'] })));
}

async function unreadCount(req, res) {
  res.json({ unreadCount: await notificationService.countUnread(req.user) });
}

async function markAsRead(req, res) {
  const notification = await notificationService.markAsRead(req.user, req.params.id);
  res.json({ notification });
}

async function markAllAsRead(req, res) {
  res.json({ updated: await notificationService.markAllAsRead(req.user) });
}

async function remove(req, res) {
  await notificationService.deleteNotification(req.user, req.params.id);
  res.status(204).end();
}

module.exports = { list, unreadCount, markAsRead, markAllAsRead, remove };
