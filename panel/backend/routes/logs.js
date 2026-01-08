const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// POST /api/logs/ingest - Ingest logs (Internal/Rspamd)
router.post('/ingest', logsController.ingest);

router.use(authenticateToken);

// GET /api/logs - List mail logs
router.get('/', logsController.list);

// GET /api/logs/stats - Log statistics
router.get('/stats', logsController.stats);

// GET /api/logs/:id - Get single log
router.get('/:id', logsController.get);

// POST /api/logs/:id/approve - Approve sender from log
router.post('/:id/approve', logsController.approve);

// POST /api/logs/:id/reject - Reject sender from log
router.post('/:id/reject', logsController.reject);

module.exports = router;
