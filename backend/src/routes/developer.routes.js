const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../models/user.model');
const { listDevelopersRules } = require('../validators/user.validator');

const router = Router();

// Developer directory: project managers pick team members here (admins can browse it too).
router.get(
  '/',
  authenticate,
  authorize(ROLES.PROJECT_MANAGER, ROLES.ADMIN),
  validate(listDevelopersRules),
  userController.listDevelopers,
);

module.exports = router;
