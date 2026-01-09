const express = require('express');
const router = express.Router();
const autoBlacklistController = require('../controllers/auto-blacklist.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Public webhook endpoint for RSPAMD (no auth required, but should be internal network only)
// POST /api/blacklist/auto - Auto-add from RSPAMD webhook
router.post('/auto', autoBlacklistController.autoAdd);

// Protected endpoints for admin panel
router.use(authenticateToken);

// GET /api/blacklist/auto/stats - Get auto-blacklist statistics
router.get('/auto/stats', autoBlacklistController.stats);

// POST /api/blacklist/auto/cleanup - Clean old auto entries
router.post('/auto/cleanup', requireRole(['super-admin']), autoBlacklistController.cleanup);

module.exports = router;
