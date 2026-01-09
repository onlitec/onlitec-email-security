const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication and admin role
router.use(authenticateToken);

// List queue
router.get('/', queueController.list);

// Get email details
router.get('/:id', queueController.get);

// Delete email
router.delete('/:id', queueController.delete);

// Flush single email
router.post('/:id/flush', queueController.flush);

// Hold email
router.post('/:id/hold', queueController.hold);

// Release held email
router.post('/:id/release', queueController.release);

// Flush all emails
router.post('/flush-all', queueController.flushAll);

// Delete all emails
router.delete('/all', queueController.deleteAll);

// Delete by sender pattern
router.post('/delete-by-sender', queueController.deleteByPattern);

module.exports = router;
