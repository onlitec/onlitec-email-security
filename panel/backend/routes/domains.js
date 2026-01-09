const express = require('express');
const router = express.Router();
const domainsController = require('../controllers/domains.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET /api/domains - List all domains
router.get('/', domainsController.list);

// GET /api/domains/:id - Get single domain
router.get('/:id', domainsController.get);

// POST /api/domains - Create domain
router.post('/', requireRole(['superadmin', 'admin']), domainsController.create);

// PUT /api/domains/:id - Update domain
router.put('/:id', requireRole(['superadmin', 'admin']), domainsController.update);

// POST /api/domains/:id/generate-dkim - Generate DKIM keys
router.post('/:id/generate-dkim', requireRole(['superadmin', 'admin']), domainsController.generateDkim);

// POST /api/domains/:id/verify-dns - Verify DNS records
router.post('/:id/verify-dns', requireRole(['superadmin', 'admin']), domainsController.verifyDns);

// DELETE /api/domains/:id - Delete domain
router.delete('/:id', requireRole(['superadmin', 'admin']), domainsController.delete);

module.exports = router;
