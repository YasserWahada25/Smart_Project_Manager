const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { searchRules } = require('../validators/dashboard.validator');

// Mounted at the API root: GET /dashboard, GET /search. The project dashboard is under /projects/:id/dashboard.
const router = Router();

router.get('/dashboard', authenticate, dashboardController.global);
router.get('/search', authenticate, validate(searchRules), dashboardController.search);

module.exports = router;
