const { Router } = require('express');
const projectController = require('../controllers/project.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../models/user.model');
const {
  createProjectRules,
  updateProjectRules,
  listProjectsRules,
  projectIdRules,
  addMemberRules,
  removeMemberRules,
} = require('../validators/project.validator');
const sprintController = require('../controllers/sprint.controller');
const { createSprintRules, listSprintsRules } = require('../validators/sprint.validator');
const taskController = require('../controllers/task.controller');
const { createTaskRules, listTasksRules, boardRules } = require('../validators/task.validator');
const activityController = require('../controllers/activity.controller');
const { projectActivitiesRules } = require('../validators/comment.validator');
const dashboardController = require('../controllers/dashboard.controller');
const { projectDashboardRules } = require('../validators/dashboard.validator');

const router = Router();

router.use(authenticate);

// Visibility (admin / manager / member) and "manager only" rules are enforced in the service.
router.get('/', validate(listProjectsRules), projectController.list);
router.post('/', authorize(ROLES.PROJECT_MANAGER), validate(createProjectRules), projectController.create);
router.get('/:id', validate(projectIdRules), projectController.getById);
router.patch('/:id', validate(updateProjectRules), projectController.update);
router.delete('/:id', validate(projectIdRules), projectController.remove);
router.post('/:id/members', validate(addMemberRules), projectController.addMember);
router.delete('/:id/members/:userId', validate(removeMemberRules), projectController.removeMember);

// Sprints of a project
router.get('/:id/sprints', validate(listSprintsRules), sprintController.listByProject);
router.post('/:id/sprints', validate(createSprintRules), sprintController.create);

// Tasks of a project and Kanban board
router.get('/:id/tasks', validate(listTasksRules), taskController.listByProject);
router.post('/:id/tasks', validate(createTaskRules), taskController.create);
router.get('/:id/board', validate(boardRules), taskController.board);

// Activity history of a project
router.get('/:id/activities', validate(projectActivitiesRules), activityController.listByProject);

// Project dashboard
router.get('/:id/dashboard', validate(projectDashboardRules), dashboardController.project);

module.exports = router;
