const express = require('express');
const router = express.Router();
const blacklistController = require('../controllers/blacklist.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// GET /api/blacklist - List entries
router.get('/', blacklistController.list);

// POST /api/blacklist - Add entry
router.post('/', requireRole(['super-admin', 'admin']), blacklistController.create);

// DELETE /api/blacklist/:id - Remove entry
router.delete('/:id', requireRole(['super-admin', 'admin']), blacklistController.delete);

module.exports = router;
