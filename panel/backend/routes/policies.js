const express = require('express');
const router = express.Router();
const policiesController = require('../controllers/policies.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/', policiesController.list);
router.get('/:id', policiesController.get);
router.post('/', requireRole(['superadmin', 'admin']), policiesController.create);
router.put('/:id', requireRole(['superadmin', 'admin']), policiesController.update);
router.delete('/:id', requireRole(['superadmin', 'admin']), policiesController.delete);

module.exports = router;
