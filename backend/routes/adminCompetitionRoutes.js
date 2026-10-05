const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/competitionController');
router.use(protect,authorize('admin'));
router.get('/',c.list);
router.post('/',c.create);
module.exports = router;
