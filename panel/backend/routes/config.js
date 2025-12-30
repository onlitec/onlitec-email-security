/**
 * Runtime Configuration Endpoint
 * Provides public configuration to the frontend at runtime
 * This allows the same frontend build to work in any environment
 */

const express = require('express');
const router = express.Router();
const config = require('../config');

/**
 * GET /api/config
 * Returns public configuration for the frontend
 * NO secrets should be exposed here!
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            // Environment
            env: config.env,
            isProduction: config.isProduction,

            // URLs (public)
            appUrl: config.app.url,
            apiUrl: config.api.url,

            // Features
            features: {
                analytics: config.isProduction,
                debugMode: config.isDevelopment,
            },

            // Versioning
            version: process.env.APP_VERSION || '1.0.0',

            // Mail domain (for display purposes)
            mailDomain: config.mail.domain,
        }
    });
});

module.exports = router;
