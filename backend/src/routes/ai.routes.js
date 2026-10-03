const { Router } = require('express');
const aiController = require('../controllers/ai.controller');
const authenticate = require('../middleware/authenticate');

const router = Router();

// Availability of the AI service (any signed-in user: shown on the home page).
router.get('/status', authenticate, aiController.getStatus);

module.exports = router;
