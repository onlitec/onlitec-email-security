const express = require('express');
const router = express.Router();
const whitelistController = require('../controllers/whitelist.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// GET /api/whitelist - List entries
router.get('/', whitelistController.list);

// POST /api/whitelist - Add entry
router.post('/', requireRole(['superadmin', 'admin']), whitelistController.create);

// DELETE /api/whitelist/:id - Remove entry
router.delete('/:id', requireRole(['superadmin', 'admin']), whitelistController.delete);

module.exports = router;
