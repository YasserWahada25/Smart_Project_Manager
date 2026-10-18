const { Router } = require('express');
const sprintController = require('../controllers/sprint.controller');
const aiController = require('../controllers/ai.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { sprintIdRules, updateSprintRules, changeStatusRules } = require('../validators/sprint.validator');
const { retrospectiveRules, actionTaskRules } = require('../validators/aiRetrospective.validator');

// Sprint-level routes. Creation and listing are nested under /projects/:id/sprints (project.routes.js).
const router = Router();

router.use(authenticate);

router.get('/:id', validate(sprintIdRules), sprintController.getById);
router.patch('/:id', validate(updateSprintRules), sprintController.update);
router.patch('/:id/status', validate(changeStatusRules), sprintController.changeStatus);
router.delete('/:id', validate(sprintIdRules), sprintController.remove);

// AI-03: delay risk of a planned or active sprint (project viewers; nothing is stored)
router.get('/:id/ai/risk', validate(sprintIdRules), aiController.sprintRisk);

// AI-05: retrospective of a completed sprint (read: project viewers; generate and turn an action into a task: manager)
router.get('/:id/ai/retrospective', validate(retrospectiveRules), aiController.sprintRetrospective);
router.post('/:id/ai/retrospective', validate(retrospectiveRules), aiController.generateSprintRetrospective);
router.post(
  '/:id/ai/retrospective/actions/:actionId/task',
  validate(actionTaskRules),
  aiController.retrospectiveActionTask,
);

module.exports = router;
