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

// POST /api/tenants - Create tenant (superadmin only)
router.post('/', requireRole(['superadmin']), tenantsController.create);

// PUT /api/tenants/:id - Update tenant (superadmin only)
router.put('/:id', requireRole(['superadmin']), tenantsController.update);

// DELETE /api/tenants/:id - Delete tenant (superadmin only)
router.delete('/:id', requireRole(['superadmin']), tenantsController.delete);

module.exports = router;
