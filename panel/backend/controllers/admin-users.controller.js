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

// List all admin users
exports.listUsers = async (req, res) => {
    try {
        const { role, status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, email, full_name, role, status, last_login, created_at, updated_at
            FROM admin_users
            WHERE deleted_at IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND role = $${paramIndex++}`;
            params.push(role);
        }

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        // Count total
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Add pagination
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error listing users:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list users' } });
    }
};

// Get single user
exports.getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT id, email, full_name, role, status, last_login, created_at, updated_at
            FROM admin_users
            WHERE id = $1 AND deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error getting user:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get user' } });
    }
};

// Create new user
exports.createUser = async (req, res) => {
    try {
        const { email, password, full_name, role = 'viewer', status = 'active' } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
        }

        // Validate role
        const validRoles = ['super-admin', 'admin', 'manager', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } });
        }

        // Check if current user can create this role
        const currentUserRole = req.user.role;
        if (currentUserRole !== 'super-admin' && (role === 'super-admin' || role === 'admin')) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot create users with this role' } });
        }

        // Check if email already exists
        const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1 AND deleted_at IS NULL', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Email already exists' } });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = await pool.query(`
            INSERT INTO admin_users (email, password_hash, full_name, role, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, full_name, role, status, created_at
        `, [email.toLowerCase(), passwordHash, full_name, role, status]);

        logger.info(`User created: ${email} by ${req.user.email}`);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error creating user:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create user' } });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, full_name, role, status } = req.body;

        // Check user exists
        const existing = await pool.query('SELECT * FROM admin_users WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        const targetUser = existing.rows[0];

        // Check permissions
        const currentUserRole = req.user.role;
        if (currentUserRole !== 'super-admin') {
            // Admins cannot modify superadmins or other admins
            if (targetUser.role === 'super-admin' || targetUser.role === 'admin') {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot modify this user' } });
            }
            // Admins cannot promote to admin/superadmin
            if (role === 'super-admin' || role === 'admin') {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot assign this role' } });
            }
        }

        // Check if email changed and is unique
        if (email && email !== targetUser.email) {
            const emailCheck = await pool.query('SELECT id FROM admin_users WHERE email = $1 AND id != $2 AND deleted_at IS NULL', [email, id]);
            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Email already exists' } });
            }
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (email) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email.toLowerCase());
        }
        if (full_name !== undefined) {
            updates.push(`full_name = $${paramIndex++}`);
            params.push(full_name);
        }
        if (role) {
            updates.push(`role = $${paramIndex++}`);
            params.push(role);
        }
        if (status) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
            UPDATE admin_users 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, email, full_name, role, status, updated_at
        `;

        const result = await pool.query(query, params);

        logger.info(`User updated: ${id} by ${req.user.email}`);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update user' } });
    }
};

// Delete user (soft delete)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Cannot delete self
        if (id === req.user.userId) {
            return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'You cannot delete your own account' } });
        }

        // Check user exists
        const existing = await pool.query('SELECT * FROM admin_users WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        const targetUser = existing.rows[0];

        // Check permissions
        const currentUserRole = req.user.role;
        if (currentUserRole !== 'super-admin') {
            if (targetUser.role === 'super-admin' || targetUser.role === 'admin') {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot delete this user' } });
            }
        }

        // Check if this is the last superadmin
        if (targetUser.role === 'super-admin') {
            const superadminCount = await pool.query("SELECT COUNT(*) FROM admin_users WHERE role = 'super-admin' AND deleted_at IS NULL");
            if (parseInt(superadminCount.rows[0].count) <= 1) {
                return res.status(400).json({ success: false, error: { code: 'LAST_SUPERADMIN', message: 'Cannot delete the last superadmin' } });
            }
        }

        // Soft delete
        await pool.query('UPDATE admin_users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);

        // Delete sessions
        await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [id]);

        logger.info(`User deleted: ${id} by ${req.user.email}`);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete user' } });
    }
};

// Reset user password
exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
        }

        // Check user exists
        const existing = await pool.query('SELECT * FROM admin_users WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        const targetUser = existing.rows[0];

        // Check permissions
        const currentUserRole = req.user.role;
        if (currentUserRole !== 'super-admin') {
            if (targetUser.role === 'super-admin' || targetUser.role === 'admin') {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot reset password for this user' } });
            }
        }

        // Hash and update password
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);

        // Delete sessions to force re-login
        await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [id]);

        logger.info(`Password reset for user: ${id} by ${req.user.email}`);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        logger.error('Error resetting password:', error);
        res.status(500).json({ success: false, error: { code: 'RESET_ERROR', message: 'Failed to reset password' } });
    }
};
