const { Pool } = require('pg');
const logger = require('../config/logger');
const nodemailer = require('nodemailer');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'emailprotect',
    user: process.env.POSTGRES_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || 'changeme123'
});

// Helper to get all settings as an object
const getAllSettings = async () => {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings = {};
    result.rows.forEach(row => {
        settings[row.key] = row.value;
    });
    return settings;
};

exports.getSettings = async (req, res, next) => {
    try {
        const settings = await getAllSettings();
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const updates = req.body; // Expect object { key: value, ... }
        const keys = Object.keys(updates);

        if (keys.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_DATA',
                    message: 'No settings provided to update'
                }
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const key of keys) {
                const value = updates[key];
                await client.query(
                    `INSERT INTO system_settings (key, value, updated_at) 
                     VALUES ($1, $2, NOW()) 
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                    [key, String(value)]
                );
            }

            await client.query('COMMIT');

            const newSettings = await getAllSettings();

            // Log the action
            logger.info(`System settings updated by user ${req.user.email}`);

            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: newSettings
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
};

exports.testSmtp = async (req, res, next) => {
    try {
        const { host, port, user, pass, secure, from, to } = req.body;

        if (!host || !port || !from || !to) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_FIELDS',
                    message: 'Host, port, from, and to fields are required'
                }
            });
        }

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure === 'true' || secure === true, // true for 465, false for other ports
            auth: user ? {
                user,
                pass
            } : undefined,
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.verify();

        await transporter.sendMail({
            from,
            to,
            subject: 'Test Email - Onlitec Email Protection',
            text: 'This is a test email to verify your SMTP configuration.',
            html: '<p>This is a test email to verify your SMTP configuration.</p>'
        });

        res.json({
            success: true,
            message: 'Test email sent successfully'
        });

    } catch (error) {
        logger.error('SMTP Test Failed', error);
        res.status(400).json({
            success: false,
            error: {
                code: 'SMTP_ERROR',
                message: error.message || 'Failed to send test email'
            }
        });
    }
};

exports.uploadBranding = async (req, res, next) => {
    try {
        const { type } = req.params; // 'logo' or 'favicon'

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILE',
                    message: 'No file uploaded'
                }
            });
        }

        if (!['logo', 'favicon'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TYPE',
                    message: 'Type must be logo or favicon'
                }
            });
        }

        // File is saved by multer, get the URL
        const fileUrl = `/uploads/${req.file.filename}`;
        const settingKey = type === 'logo' ? 'logo_url' : 'favicon_url';

        // Save to database
        await pool.query(
            `INSERT INTO system_settings (key, value, updated_at) 
             VALUES ($1, $2, NOW()) 
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [settingKey, fileUrl]
        );

        logger.info(`${type} uploaded by user ${req.user.email}: ${fileUrl}`);

        res.json({
            success: true,
            message: `${type} uploaded successfully`,
            data: {
                url: fileUrl
            }
        });

    } catch (error) {
        next(error);
    }
};
