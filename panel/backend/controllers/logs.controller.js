const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List mail logs
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 50, status, sender, recipient, date_from, date_to, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT l.id, l.message_id, l.from_address as sender, l.to_address as recipient, l.subject, 
                   l.status, l.size_bytes, l.spam_score, l.created_at,
                   t.name as tenant_name
            FROM mail_logs l
            LEFT JOIN tenants t ON l.tenant_id = t.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) { query += ` AND l.status = $${paramIndex++}`; params.push(status); }
        if (sender) { query += ` AND l.from_address ILIKE $${paramIndex++}`; params.push(`%${sender}%`); }
        if (recipient) { query += ` AND l.to_address ILIKE $${paramIndex++}`; params.push(`%${recipient}%`); }
        if (date_from) { query += ` AND l.created_at >= $${paramIndex++}`; params.push(date_from); }
        if (date_to) { query += ` AND l.created_at <= $${paramIndex++}`; params.push(date_to); }
        if (search) {
            query += ` AND (l.from_address ILIKE $${paramIndex} OR l.to_address ILIKE $${paramIndex} OR l.subject ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true, data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        logger.error('Error listing logs:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list logs' } });
    }
};

// Get single log entry
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT l.*, t.name as tenant_name, d.domain as domain_name
            FROM mail_logs l
            LEFT JOIN tenants t ON l.tenant_id = t.id
            LEFT JOIN domains d ON l.domain_id = d.id
            WHERE l.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Log entry not found' } });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error getting log:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get log' } });
    }
};

// Get log statistics
exports.stats = async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const stats = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM mail_logs
            WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
            GROUP BY status
        `);

        const timeline = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'quarantined' THEN 1 ELSE 0 END) as quarantined
            FROM mail_logs
            WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            success: true,
            data: {
                byStatus: stats.rows,
                timeline: timeline.rows
            }
        });

    } catch (error) {
        logger.error('Error getting log stats:', error);
        res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: 'Failed to get stats' } });
    }
};
