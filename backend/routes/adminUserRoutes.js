const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { listUsers, getUser, updateUserRole, deleteUser } = require('../controllers/adminUserController');

router.use(protect, authorize('admin'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

module.exports = router;
