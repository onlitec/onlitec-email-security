const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/stats - Dashboard statistics
router.get('/', statsController.getStats);

// GET /api/stats/tenant/:tenantId - Tenant-specific stats
router.get('/tenant/:tenantId', statsController.getTenantStats);

module.exports = router;
