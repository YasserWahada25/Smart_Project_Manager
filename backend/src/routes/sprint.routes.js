const { Router } = require('express');
const sprintController = require('../controllers/sprint.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { sprintIdRules, updateSprintRules, changeStatusRules } = require('../validators/sprint.validator');

// Sprint-level routes. Creation and listing are nested under /projects/:id/sprints (project.routes.js).
const router = Router();

router.use(authenticate);

router.get('/:id', validate(sprintIdRules), sprintController.getById);
router.patch('/:id', validate(updateSprintRules), sprintController.update);
router.patch('/:id/status', validate(changeStatusRules), sprintController.changeStatus);
router.delete('/:id', validate(sprintIdRules), sprintController.remove);

module.exports = router;
