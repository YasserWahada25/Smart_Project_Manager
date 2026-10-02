const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../models/user.model');
const {
  listUsersRules,
  getUserRules,
  updateStatusRules,
  updateRoleRules,
} = require('../validators/user.validator');

const router = Router();

// User administration is reserved to ADMIN accounts.
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', validate(listUsersRules), userController.list);
router.get('/:id', validate(getUserRules), userController.getById);
router.patch('/:id/status', validate(updateStatusRules), userController.updateStatus);
router.patch('/:id/role', validate(updateRoleRules), userController.updateRole);

module.exports = router;
