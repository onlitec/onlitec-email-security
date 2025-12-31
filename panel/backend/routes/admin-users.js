const express = require('express');
const router = express.Router();
const adminUsersController = require('../controllers/admin-users.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Only admin and superadmin can manage users
router.use(authorize('admin', 'superadmin', 'super-admin'));

// Routes
router.get('/', adminUsersController.listUsers);
router.get('/:id', adminUsersController.getUser);
router.post('/', adminUsersController.createUser);
router.put('/:id', adminUsersController.updateUser);
router.delete('/:id', adminUsersController.deleteUser);
router.post('/:id/reset-password', adminUsersController.resetPassword);

module.exports = router;
