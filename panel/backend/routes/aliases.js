const express = require('express');
const router = express.Router();
const aliasesController = require('../controllers/aliases.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/', aliasesController.list);
router.post('/', requireRole(['superadmin', 'admin']), aliasesController.create);
router.put('/:id', requireRole(['superadmin', 'admin']), aliasesController.update);
router.delete('/:id', requireRole(['superadmin', 'admin']), aliasesController.delete);

module.exports = router;
