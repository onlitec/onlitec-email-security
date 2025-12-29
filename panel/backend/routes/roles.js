const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/roles.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'super-admin')); // Only admins can manage roles

router.get('/', rolesController.getRoles);
router.post('/', rolesController.createRole);
router.put('/:id', rolesController.updateRole);
router.delete('/:id', rolesController.deleteRole);

module.exports = router;
