const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List audit logs
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 50, tenant_id, user_id, action, resource_type, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT a.id, a.action, a.resource_type, a.resource_id, a.changes, a.ip_address, a.created_at,
                   t.name as tenant_name, u.email as user_email
            FROM audit_log a
            LEFT JOIN tenants t ON a.tenant_id = t.id
            LEFT JOIN admin_users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (tenant_id) { query += ` AND a.tenant_id = $${paramIndex++}`; params.push(tenant_id); }
        if (user_id) { query += ` AND a.user_id = $${paramIndex++}`; params.push(user_id); }
        if (action) { query += ` AND a.action ILIKE $${paramIndex++}`; params.push(`%${action}%`); }
        if (resource_type) { query += ` AND a.resource_type = $${paramIndex++}`; params.push(resource_type); }
        if (date_from) { query += ` AND a.created_at >= $${paramIndex++}`; params.push(date_from); }
        if (date_to) { query += ` AND a.created_at <= $${paramIndex++}`; params.push(date_to); }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true, data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error('Error listing audit logs:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list audit logs' } });
    }
};

// Get single audit log entry
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT a.*, t.name as tenant_name, u.email as user_email
            FROM audit_log a
            LEFT JOIN tenants t ON a.tenant_id = t.id
            LEFT JOIN admin_users u ON a.user_id = u.id
            WHERE a.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error getting audit log:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get audit log' } });
    }
};

// Get audit statistics
exports.stats = async (req, res) => {
    try {
        // Actions by type (last 7 days)
        const byAction = await pool.query(`
            SELECT action, COUNT(*) as count
            FROM audit_log
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY action ORDER BY count DESC LIMIT 10
        `);

        // Activity by day (last 7 days)
        const byDay = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM audit_log
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at) ORDER BY date ASC
        `);

        // Top users (last 7 days)
        const byUser = await pool.query(`
            SELECT u.email, COUNT(*) as count
            FROM audit_log a
            JOIN admin_users u ON a.user_id = u.id
            WHERE a.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY u.email ORDER BY count DESC LIMIT 5
        `);

        res.json({
            success: true,
            data: {
                byAction: byAction.rows,
                byDay: byDay.rows,
                byUser: byUser.rows
            }
        });
    } catch (error) {
        logger.error('Error getting audit stats:', error);
        res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: 'Failed to get audit statistics' } });
    }
};
