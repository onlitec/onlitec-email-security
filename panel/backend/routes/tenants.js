const express = require('express');
const router = express.Router();
const tenantsController = require('../controllers/tenants.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/tenants - List all tenants
router.get('/', tenantsController.list);

// GET /api/tenants/:id - Get single tenant
router.get('/:id', tenantsController.get);

// POST /api/tenants - Create tenant (super-admin only)
router.post('/', requireRole(['super-admin']), tenantsController.create);

// PUT /api/tenants/:id - Update tenant (super-admin only)
router.put('/:id', requireRole(['super-admin']), tenantsController.update);

// DELETE /api/tenants/:id - Delete tenant (super-admin only)
router.delete('/:id', requireRole(['super-admin']), tenantsController.delete);

module.exports = router;
