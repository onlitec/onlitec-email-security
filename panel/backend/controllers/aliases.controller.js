const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

const { getRedisClient } = require('../config/redis');

async function syncRecipientToRedis(tenant_id, email, exists) {
    try {
        const redis = await getRedisClient();
        const key = `tenant:${tenant_id}:recipient:${email.toLowerCase()}`;
        if (exists) {
            await redis.set(key, '1');
        } else {
            await redis.del(key);
        }
    } catch (err) {
        logger.error('Error syncing recipient to Redis:', err);
    }
}

// List virtual addresses (aliases)
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 50, tenant_id, domain_id, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT v.id, v.email, v.destination, v.is_catch_all, v.enabled, v.created_at,
                   t.name as tenant_name, d.domain as domain_name
            FROM virtual_addresses v
            LEFT JOIN tenants t ON v.tenant_id = t.id
            LEFT JOIN domains d ON v.domain_id = d.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (tenant_id) { query += ` AND v.tenant_id = $${paramIndex++}`; params.push(tenant_id); }
        if (domain_id) { query += ` AND v.domain_id = $${paramIndex++}`; params.push(domain_id); }
        if (search) { query += ` AND (v.email ILIKE $${paramIndex} OR v.destination ILIKE $${paramIndex})`; params.push(`%${search}%`); paramIndex++; }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

        query += ` ORDER BY v.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true, data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error('Error listing aliases:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list aliases' } });
    }
};

// Create alias
exports.create = async (req, res) => {
    try {
        const { email, destination, tenant_id, domain_id, is_catch_all = false } = req.body;

        if (!email || !destination || !tenant_id || !domain_id) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email, destination, tenant_id, and domain_id are required' } });
        }

        // Check uniqueness
        const existing = await pool.query('SELECT id FROM virtual_addresses WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Email alias already exists' } });
        }

        const result = await pool.query(`
            INSERT INTO virtual_addresses (email, destination, tenant_id, domain_id, is_catch_all)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [email, destination, tenant_id, domain_id, is_catch_all]);

        logger.info(`Alias created: ${email} -> ${destination}`);

        // Sync to Redis
        await syncRecipientToRedis(tenant_id, email, true);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error creating alias:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create alias' } });
    }
};

// Update alias
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { destination, is_catch_all, enabled } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (destination) { updates.push(`destination = $${paramIndex++}`); params.push(destination); }
        if (is_catch_all !== undefined) { updates.push(`is_catch_all = $${paramIndex++}`); params.push(is_catch_all); }
        if (enabled !== undefined) { updates.push(`enabled = $${paramIndex++}`); params.push(enabled); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const result = await pool.query(`
            UPDATE virtual_addresses SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alias not found' } });
        }

        res.json({ success: true, data: result.rows[0] });

        // Sync to Redis
        if (result.rows[0].enabled === false) {
            await syncRecipientToRedis(result.rows[0].tenant_id, result.rows[0].email, false);
        } else {
            await syncRecipientToRedis(result.rows[0].tenant_id, result.rows[0].email, true);
        }
    } catch (error) {
        logger.error('Error updating alias:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update alias' } });
    }
};

// Delete alias
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM virtual_addresses WHERE id = $1 RETURNING email', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Alias not found' } });
        }

        logger.info(`Alias deleted: ${result.rows[0].email}`);

        // Sync to Redis
        await syncRecipientToRedis(result.rows[0].tenant_id, result.rows[0].email, false);

        res.json({ success: true, message: 'Alias deleted successfully' });
    } catch (error) {
        logger.error('Error deleting alias:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete alias' } });
    }
};
