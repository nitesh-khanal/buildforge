const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const c = require('../controllers/competitionController');
router.get('/', c.list);
router.get('/:id', optionalAuth, c.detail);
router.post('/:id/entries', protect, c.enter);
router.put('/:id/entries/:entryId/vote', protect, c.vote);
module.exports = router;
