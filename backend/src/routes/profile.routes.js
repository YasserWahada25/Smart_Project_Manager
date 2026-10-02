const { Router } = require('express');
const profileController = require('../controllers/profile.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { updateProfileRules, changePasswordRules, replaceSkillsRules } = require('../validators/profile.validator');

const router = Router();

// Self-service: every authenticated user manages their own profile.
router.use(authenticate);

router.get('/', profileController.get);
router.patch('/', validate(updateProfileRules), profileController.update);
router.patch('/password', validate(changePasswordRules), profileController.changePassword);
router.put('/skills', validate(replaceSkillsRules), profileController.replaceSkills);

module.exports = router;
