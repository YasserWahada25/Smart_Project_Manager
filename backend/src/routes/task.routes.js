const { Router } = require('express');
const taskController = require('../controllers/task.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  taskIdRules,
  updateTaskRules,
  changeStatusRules,
  assignRules,
  myTasksRules,
} = require('../validators/task.validator');
const commentController = require('../controllers/comment.controller');
const activityController = require('../controllers/activity.controller');
const aiController = require('../controllers/ai.controller');
const { listCommentsRules, createCommentRules, taskActivitiesRules } = require('../validators/comment.validator');

// Task-level routes. Creation, listing and the Kanban board are nested under /projects/:id.
const router = Router();

router.use(authenticate);

router.get('/assigned', validate(myTasksRules), taskController.listMine);
router.get('/:id', validate(taskIdRules), taskController.getById);
router.patch('/:id', validate(updateTaskRules), taskController.update);
router.patch('/:id/status', validate(changeStatusRules), taskController.changeStatus);
router.patch('/:id/assignee', validate(assignRules), taskController.assign);
router.delete('/:id', validate(taskIdRules), taskController.remove);

// Comments and history of a task
router.get('/:id/comments', validate(listCommentsRules), commentController.listByTask);
router.post('/:id/comments', validate(createCommentRules), commentController.create);
router.get('/:id/activities', validate(taskActivitiesRules), activityController.listByTask);

// AI-02: developers recommended for the task (project manager; nothing is stored)
router.get('/:id/ai/recommendations', validate(taskIdRules), aiController.recommendDevelopers);

module.exports = router;
