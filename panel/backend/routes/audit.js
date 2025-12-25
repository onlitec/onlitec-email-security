const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);
router.use(requireRole(['super-admin'])); // Only super-admin can view audit logs

router.get('/', auditController.list);
router.get('/stats', auditController.stats);
router.get('/:id', auditController.get);

module.exports = router;
