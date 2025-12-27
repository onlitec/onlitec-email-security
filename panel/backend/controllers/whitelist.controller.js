const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List whitelist entries
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT id, tenant_id, type, value, comment, created_at FROM whitelist WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (type) { query += ` AND type = $${paramIndex++}`; params.push(type); }
        if (search) { query += ` AND value ILIKE $${paramIndex++}`; params.push(`%${search}%`); }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true, data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        logger.error('Error listing whitelist:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list whitelist' } });
    }
};

// Add to whitelist
exports.create = async (req, res) => {
    try {
        const { type, value, comment } = req.body;

        if (!type || !value) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Type and value are required' } });
        }

        // Get first tenant (default for now)
        const tenantResult = await pool.query('SELECT id FROM tenants WHERE status = $1 LIMIT 1', ['active']);
        if (tenantResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_TENANT', message: 'No active tenant found' } });
        }
        const tenant_id = tenantResult.rows[0].id;

        const existing = await pool.query('SELECT id FROM whitelist WHERE tenant_id = $1 AND type = $2 AND value = $3', [tenant_id, type, value]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Entry already exists' } });
        }

        const result = await pool.query(`
            INSERT INTO whitelist (tenant_id, type, value, comment) VALUES ($1, $2, $3, $4) RETURNING *
        `, [tenant_id, type, value, comment || null]);

        logger.info(`Whitelist entry created: ${type}:${value}`);
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error creating whitelist entry:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create entry' } });
    }
};


// Delete from whitelist
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM whitelist WHERE id = $1 RETURNING id, value', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } });
        }

        logger.info(`Whitelist entry deleted: ${result.rows[0].value}`);
        res.json({ success: true, message: 'Entry deleted successfully' });

    } catch (error) {
        logger.error('Error deleting whitelist entry:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete entry' } });
    }
};
