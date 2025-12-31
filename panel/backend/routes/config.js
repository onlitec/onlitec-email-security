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

/**
 * GET /api/config/branding
 * Returns public branding configuration (logo, favicon, site name)
 * This endpoint is PUBLIC - no authentication required
 */
router.get('/branding', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
            port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
            database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
            user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
            password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
        });

        const result = await pool.query(
            "SELECT key, value FROM system_settings WHERE key IN ('site_name', 'logo_url', 'favicon_url')"
        );

        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        await pool.end();

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching branding:', error);
        res.json({
            success: true,
            data: {
                site_name: 'Onlitec Email Protection',
                logo_url: '',
                favicon_url: ''
            }
        });
    }
});

module.exports = router;
