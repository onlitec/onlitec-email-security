const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(`
            SELECT id, email, full_name, role, created_at, updated_at
            FROM admin_users WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error getting profile:', error);
        res.status(500).json({ success: false, error: { code: 'PROFILE_ERROR', message: 'Failed to get profile' } });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { full_name } = req.body;

        const result = await pool.query(`
            UPDATE admin_users SET full_name = $1, updated_at = NOW()
            WHERE id = $2 RETURNING id, email, full_name, role
        `, [full_name, userId]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update profile' } });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Current and new password required' } });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
        }

        // Get current password hash
        const user = await pool.query('SELECT password_hash FROM admin_users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
        }

        // Hash and update new password
        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

        logger.info(`Password changed for user: ${req.user.email}`);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        logger.error('Error changing password:', error);
        res.status(500).json({ success: false, error: { code: 'PASSWORD_ERROR', message: 'Failed to change password' } });
    }
};

// Update email
exports.updateEmail = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { newEmail, currentPassword } = req.body;

        if (!newEmail || !currentPassword) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'New email and current password required' } });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
        }

        // Get current user
        const user = await pool.query('SELECT email, password_hash FROM admin_users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        // Check if email is the same
        if (user.rows[0].email === newEmail.toLowerCase()) {
            return res.status(400).json({ success: false, error: { code: 'SAME_EMAIL', message: 'New email is the same as current email' } });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
        }

        // Check if email already exists
        const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1 AND id != $2 AND deleted_at IS NULL', [newEmail.toLowerCase(), userId]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Email already exists' } });
        }

        // Update email
        await pool.query('UPDATE admin_users SET email = $1, updated_at = NOW() WHERE id = $2', [newEmail.toLowerCase(), userId]);

        logger.info(`Email changed for user: ${req.user.email} -> ${newEmail}`);
        res.json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
        logger.error('Error updating email:', error);
        res.status(500).json({ success: false, error: { code: 'EMAIL_ERROR', message: 'Failed to update email' } });
    }
};
