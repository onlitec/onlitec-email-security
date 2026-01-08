const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

// POST /api/reports - Generate and download PDF report
router.post('/', reportsController.generateReport);

// POST /api/reports/email - Generate and email PDF report
router.post('/email', reportsController.emailReport);

module.exports = router;
