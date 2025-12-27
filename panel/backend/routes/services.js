const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/services.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// GET /api/services/status - Get status of all services
router.get('/status', servicesController.getStatus);

// GET /api/services/metrics - Get detailed metrics
router.get('/metrics', servicesController.getMetrics);

// GET /api/services/queue - Get Postfix queue
router.get('/queue', servicesController.getQueue);

module.exports = router;
