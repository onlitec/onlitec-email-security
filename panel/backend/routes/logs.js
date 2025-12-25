const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// GET /api/logs - List mail logs
router.get('/', logsController.list);

// GET /api/logs/stats - Log statistics
router.get('/stats', logsController.stats);

// GET /api/logs/:id - Get single log
router.get('/:id', logsController.get);

module.exports = router;
