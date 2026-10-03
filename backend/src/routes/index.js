const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const profileRoutes = require('./profile.routes');
const developerRoutes = require('./developer.routes');
const projectRoutes = require('./project.routes');
const sprintRoutes = require('./sprint.routes');
const taskRoutes = require('./task.routes');
const commentRoutes = require('./comment.routes');
const notificationRoutes = require('./notification.routes');
const dashboardRoutes = require('./dashboard.routes');
const aiRoutes = require('./ai.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profile', profileRoutes);
router.use('/developers', developerRoutes);
router.use('/projects', projectRoutes);
router.use('/sprints', sprintRoutes);
router.use('/tasks', taskRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/', dashboardRoutes);

module.exports = router;
