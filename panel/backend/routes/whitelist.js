const express = require('express');
const router = express.Router();
const whitelistController = require('../controllers/whitelist.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// GET /api/whitelist - List entries
router.get('/', whitelistController.list);

// POST /api/whitelist - Add entry
router.post('/', requireRole(['super-admin', 'admin']), whitelistController.create);

// DELETE /api/whitelist/:id - Remove entry
router.delete('/:id', requireRole(['super-admin', 'admin']), whitelistController.delete);

module.exports = router;
