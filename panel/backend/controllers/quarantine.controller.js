const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List quarantined emails
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'quarantined', type, search, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT q.id, q.sender, q.recipient, q.subject, q.reason, q.score,
                   q.status, q.quarantine_type, q.size_bytes, q.created_at,
                   t.name as tenant_name
            FROM quarantine q
            LEFT JOIN tenants t ON q.tenant_id = t.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) { query += ` AND q.status = $${paramIndex++}`; params.push(status); }
        if (type) { query += ` AND q.quarantine_type = $${paramIndex++}`; params.push(type); }
        if (search) {
            query += ` AND (q.sender ILIKE $${paramIndex} OR q.recipient ILIKE $${paramIndex} OR q.subject ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (date_from) { query += ` AND q.created_at >= $${paramIndex++}`; params.push(date_from); }
        if (date_to) { query += ` AND q.created_at <= $${paramIndex++}`; params.push(date_to); }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        query += ` ORDER BY q.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        logger.error('Error listing quarantine:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list quarantine' } });
    }
};

// Get single quarantined email
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT q.*, t.name as tenant_name
            FROM quarantine q
            LEFT JOIN tenants t ON q.tenant_id = t.id
            WHERE q.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email not found' } });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error getting quarantine:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get email' } });
    }
};

// Release email from quarantine
exports.release = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE quarantine 
            SET status = 'released', released_at = NOW(), released_by = $2
            WHERE id = $1 AND status = 'quarantined'
            RETURNING id, sender, recipient, subject
        `, [id, req.user?.email || 'admin']);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email not found or already released' } });
        }

        logger.info(`Email released from quarantine: ${id} by ${req.user?.email}`);
        res.json({ success: true, message: 'Email released successfully', data: result.rows[0] });

    } catch (error) {
        logger.error('Error releasing email:', error);
        res.status(500).json({ success: false, error: { code: 'RELEASE_ERROR', message: 'Failed to release email' } });
    }
};

// Delete quarantined email permanently
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE quarantine SET status = 'deleted', deleted_at = NOW()
            WHERE id = $1 AND status != 'deleted'
            RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email not found' } });
        }

        logger.info(`Quarantined email deleted: ${id}`);
        res.json({ success: true, message: 'Email deleted successfully' });

    } catch (error) {
        logger.error('Error deleting email:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete email' } });
    }
};

// Bulk actions
exports.bulkRelease = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'IDs array required' } });
        }

        const result = await pool.query(`
            UPDATE quarantine SET status = 'released', released_at = NOW()
            WHERE id = ANY($1) AND status = 'quarantined'
        `, [ids]);

        logger.info(`Bulk release: ${result.rowCount} emails`);
        res.json({ success: true, message: `${result.rowCount} emails released` });

    } catch (error) {
        logger.error('Error bulk releasing:', error);
        res.status(500).json({ success: false, error: { code: 'BULK_ERROR', message: 'Failed to release emails' } });
    }
};
