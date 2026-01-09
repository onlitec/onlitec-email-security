const express = require('express');
const router = express.Router();
const blacklistController = require('../controllers/blacklist.controller');
const autoBlacklistController = require('../controllers/auto-blacklist.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// ============================================
// PUBLIC WEBHOOK (No auth - internal network only)
// ============================================

// POST /api/blacklist/auto - RSPAMD webhook for auto-blacklist
router.post('/auto', autoBlacklistController.autoAdd);

// ============================================
// PROTECTED ENDPOINTS (Auth required)
// ============================================

router.use(authenticateToken);

// GET /api/blacklist - List entries
router.get('/', blacklistController.list);

// POST /api/blacklist - Add entry (manual)
router.post('/', requireRole(['superadmin', 'admin']), blacklistController.create);

// DELETE /api/blacklist/:id - Remove entry
router.delete('/:id', requireRole(['superadmin', 'admin']), blacklistController.delete);

// GET /api/blacklist/auto/stats - Auto-blacklist statistics
router.get('/auto/stats', autoBlacklistController.stats);

// POST /api/blacklist/auto/sync - Sync blacklist to Redis
router.post('/auto/sync', requireRole(['superadmin', 'admin']), autoBlacklistController.sync);

// POST /api/blacklist/auto/cleanup - Clean old auto entries
router.post('/auto/cleanup', requireRole(['superadmin']), autoBlacklistController.cleanup);

module.exports = router;
