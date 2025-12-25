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

// List all users
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 20, tenant_id, domain_id, status, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.id, u.email, u.tenant_id, u.domain_id, u.status, 
                   u.quota_mb, u.used_mb, u.created_at,
                   t.name as tenant_name, d.domain as domain_name
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            LEFT JOIN domains d ON u.domain_id = d.id
            WHERE u.deleted_at IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (tenant_id) { query += ` AND u.tenant_id = $${paramIndex++}`; params.push(tenant_id); }
        if (domain_id) { query += ` AND u.domain_id = $${paramIndex++}`; params.push(domain_id); }
        if (status) { query += ` AND u.status = $${paramIndex++}`; params.push(status); }
        if (search) { query += ` AND u.email ILIKE $${paramIndex++}`; params.push(`%${search}%`); }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        logger.error('Error listing users:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list users' } });
    }
};

// Get single user
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT u.*, t.name as tenant_name, d.domain as domain_name
            FROM users u
            LEFT JOIN tenants t ON u.tenant_id = t.id
            LEFT JOIN domains d ON u.domain_id = d.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        // Remove password hash from response
        const user = result.rows[0];
        delete user.password_hash;

        res.json({ success: true, data: user });

    } catch (error) {
        logger.error('Error getting user:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get user' } });
    }
};

// Create user
exports.create = async (req, res) => {
    try {
        const { email, password, tenant_id, domain_id, quota_mb = 1024, status = 'active' } = req.body;

        if (!email || !password || !tenant_id || !domain_id) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email, password, tenant_id, and domain_id are required' }
            });
        }

        // Check email uniqueness
        const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Email already exists' } });
        }

        // Check tenant user limit
        const tenant = await pool.query('SELECT max_users FROM tenants WHERE id = $1', [tenant_id]);
        if (tenant.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
        }

        const userCount = await pool.query('SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND deleted_at IS NULL', [tenant_id]);
        if (parseInt(userCount.rows[0].count) >= tenant.rows[0].max_users) {
            return res.status(403).json({ success: false, error: { code: 'LIMIT_EXCEEDED', message: 'Tenant user limit exceeded' } });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO users (email, password_hash, tenant_id, domain_id, quota_mb, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, tenant_id, domain_id, quota_mb, status, created_at
        `, [email, password_hash, tenant_id, domain_id, quota_mb, status]);

        // Also create SASL password entry for Postfix
        await pool.query(`
            INSERT INTO postfix_sasl_passwords (email, password_hash, domain_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE SET password_hash = $2
        `, [email, password_hash, domain_id]);

        logger.info(`User created: ${email}`);
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error creating user:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create user' } });
    }
};

// Update user
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { password, quota_mb, status } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (password) {
            const password_hash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(password_hash);
        }
        if (quota_mb) { updates.push(`quota_mb = $${paramIndex++}`); params.push(quota_mb); }
        if (status) { updates.push(`status = $${paramIndex++}`); params.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const result = await pool.query(`
            UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL
            RETURNING id, email, tenant_id, domain_id, quota_mb, status, updated_at
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        // Update SASL password if password changed
        if (password) {
            const password_hash = await bcrypt.hash(password, 10);
            await pool.query(`UPDATE postfix_sasl_passwords SET password_hash = $1 WHERE email = $2`,
                [password_hash, result.rows[0].email]);
        }

        logger.info(`User updated: ${id}`);
        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update user' } });
    }
};

// Delete user
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE users SET deleted_at = NOW(), status = 'deleted'
            WHERE id = $1 AND deleted_at IS NULL RETURNING id, email
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        // Remove SASL password
        await pool.query('DELETE FROM postfix_sasl_passwords WHERE email = $1', [result.rows[0].email]);

        logger.info(`User deleted: ${result.rows[0].email}`);
        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete user' } });
    }
};
