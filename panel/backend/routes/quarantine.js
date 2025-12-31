const express = require('express');
const router = express.Router();
const quarantineController = require('../controllers/quarantine.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// GET /api/quarantine - List quarantined emails
router.get('/', quarantineController.list);

// GET /api/quarantine/:id - Get single email
router.get('/:id', quarantineController.get);

// POST /api/quarantine/:id/release - Release email
router.post('/:id/release', requireRole(['superadmin', 'admin']), quarantineController.release);

// POST /api/quarantine/bulk-release - Bulk release
router.post('/bulk-release', requireRole(['superadmin', 'admin']), quarantineController.bulkRelease);

// DELETE /api/quarantine/:id - Delete email
router.delete('/:id', requireRole(['superadmin', 'admin']), quarantineController.delete);

module.exports = router;
