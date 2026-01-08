const express = require('express');
const router = express.Router();
const quarantineController = require('../controllers/quarantine.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// POST /api/quarantine/ingest - Ingest quarantined email (Internal)
router.post('/ingest', quarantineController.ingest);

router.use(authenticateToken);

// GET /api/quarantine - List quarantined emails
router.get('/', quarantineController.list);

// GET /api/quarantine/:id - Get single email
router.get('/:id', quarantineController.get);

// POST /api/quarantine/:id/release - Release email
router.post('/:id/release', requireRole(['superadmin', 'admin']), quarantineController.release);

// POST /api/quarantine/:id/approve - Approve email (Release + Whitelist)
router.post('/:id/approve', requireRole(['superadmin', 'admin']), quarantineController.approve);

// POST /api/quarantine/:id/reject - Reject email (Reject + Blacklist)
router.post('/:id/reject', requireRole(['superadmin', 'admin']), quarantineController.reject);

// POST /api/quarantine/bulk-release - Bulk release
router.post('/bulk-release', requireRole(['superadmin', 'admin']), quarantineController.bulkRelease);

// DELETE /api/quarantine/:id - Delete email
router.delete('/:id', requireRole(['superadmin', 'admin']), quarantineController.delete);

module.exports = router;
