const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List spam policies
exports.list = async (req, res) => {
    try {
        const { tenant_id } = req.query;

        let query = `
            SELECT p.*, t.name as tenant_name
            FROM spam_policies p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            WHERE 1=1
        `;
        const params = [];

        if (tenant_id) {
            query += ` AND p.tenant_id = $1`;
            params.push(tenant_id);
        }

        query += ` ORDER BY p.is_default DESC, p.name ASC`;
        const result = await pool.query(query, params);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Error listing policies:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list policies' } });
    }
};

// Get single policy
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT p.*, t.name as tenant_name
            FROM spam_policies p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error getting policy:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get policy' } });
    }
};

// Create policy
exports.create = async (req, res) => {
    try {
        const {
            tenant_id, name, is_default = false,
            greylisting_score = 4.0, add_header_score = 5.0, rewrite_subject_score = 10.0, reject_score = 15.0,
            enable_greylisting = true, enable_bayes = true, enable_dkim_check = true,
            enable_spf_check = true, enable_dmarc_check = true,
            quarantine_spam = true, quarantine_virus = true, quarantine_retention_days = 30
        } = req.body;

        if (!tenant_id || !name) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tenant and name are required' } });
        }

        const result = await pool.query(`
            INSERT INTO spam_policies (
                tenant_id, name, is_default, greylisting_score, add_header_score, rewrite_subject_score, reject_score,
                enable_greylisting, enable_bayes, enable_dkim_check, enable_spf_check, enable_dmarc_check,
                quarantine_spam, quarantine_virus, quarantine_retention_days
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [tenant_id, name, is_default, greylisting_score, add_header_score, rewrite_subject_score, reject_score,
            enable_greylisting, enable_bayes, enable_dkim_check, enable_spf_check, enable_dmarc_check,
            quarantine_spam, quarantine_virus, quarantine_retention_days]);

        logger.info(`Spam policy created: ${name}`);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error creating policy:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create policy' } });
    }
};

// Update policy
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const fields = ['name', 'is_default', 'greylisting_score', 'add_header_score', 'rewrite_subject_score', 'reject_score',
            'enable_greylisting', 'enable_bayes', 'enable_dkim_check', 'enable_spf_check', 'enable_dmarc_check',
            'quarantine_spam', 'quarantine_virus', 'quarantine_retention_days'];

        const updates = [];
        const params = [];
        let paramIndex = 1;

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramIndex++}`);
                params.push(req.body[field]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
        }

        params.push(id);
        const result = await pool.query(`
            UPDATE spam_policies SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error updating policy:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update policy' } });
    }
};

// Delete policy
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM spam_policies WHERE id = $1 RETURNING name', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
        }

        logger.info(`Spam policy deleted: ${result.rows[0].name}`);
        res.json({ success: true, message: 'Policy deleted successfully' });
    } catch (error) {
        logger.error('Error deleting policy:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete policy' } });
    }
};
