const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/users - List all users
router.get('/', usersController.list);

// GET /api/users/:id - Get single user
router.get('/:id', usersController.get);

// POST /api/users - Create user
router.post('/', requireRole(['super-admin', 'admin']), usersController.create);

// PUT /api/users/:id - Update user
router.put('/:id', requireRole(['super-admin', 'admin']), usersController.update);

// DELETE /api/users/:id - Delete user
router.delete('/:id', requireRole(['super-admin', 'admin']), usersController.delete);

module.exports = router;
