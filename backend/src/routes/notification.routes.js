const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { listNotificationsRules, notificationIdRules } = require('../validators/notification.validator');

// Every user only sees and manages their own notifications.
const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsRules), notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validate(notificationIdRules), notificationController.markAsRead);
router.delete('/:id', validate(notificationIdRules), notificationController.remove);

module.exports = router;
