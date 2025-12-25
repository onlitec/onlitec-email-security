const express = require('express');
const router = express.Router();
const aliasesController = require('../controllers/aliases.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/', aliasesController.list);
router.post('/', requireRole(['super-admin', 'admin']), aliasesController.create);
router.put('/:id', requireRole(['super-admin', 'admin']), aliasesController.update);
router.delete('/:id', requireRole(['super-admin', 'admin']), aliasesController.delete);

module.exports = router;
