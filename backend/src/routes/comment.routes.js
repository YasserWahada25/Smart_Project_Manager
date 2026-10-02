const { Router } = require('express');
const commentController = require('../controllers/comment.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { updateCommentRules, commentIdRules } = require('../validators/comment.validator');

// Comment-level routes. Listing and creation are nested under /tasks/:id/comments.
const router = Router();

router.use(authenticate);

router.patch('/:id', validate(updateCommentRules), commentController.update);
router.delete('/:id', validate(commentIdRules), commentController.remove);

module.exports = router;
