const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List all tenants
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, name, slug, status, max_domains, max_users, 
                   storage_quota_mb, created_at, updated_at
            FROM tenants 
            WHERE deleted_at IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR slug ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count
        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Add pagination
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

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
        logger.error('Error listing tenants:', error);
        res.status(500).json({
            success: false,
            error: { code: 'LIST_ERROR', message: 'Failed to list tenants' }
        });
    }
};

// Get single tenant
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT t.id, t.name, t.slug, t.status, t.max_domains, t.max_users, 
                   t.storage_quota_mb, t.created_at, t.updated_at,
                   (SELECT COUNT(*) FROM domains WHERE tenant_id = t.id AND deleted_at IS NULL) as domain_count,
                   (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND deleted_at IS NULL) as user_count
            FROM tenants t
            WHERE t.id = $1 AND t.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Tenant not found' }
            });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error getting tenant:', error);
        res.status(500).json({
            success: false,
            error: { code: 'GET_ERROR', message: 'Failed to get tenant' }
        });
    }
};

// Create tenant
exports.create = async (req, res) => {
    try {
        const { name, slug, max_domains = 10, max_users = 100, storage_quota_mb = 10240, status = 'active' } = req.body;

        if (!name || !slug) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name and slug are required' }
            });
        }

        // Check slug uniqueness
        const existing = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: { code: 'DUPLICATE_SLUG', message: 'Slug already exists' }
            });
        }

        const result = await pool.query(`
            INSERT INTO tenants (name, slug, max_domains, max_users, storage_quota_mb, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, slug, max_domains, max_users, storage_quota_mb, status]);

        logger.info(`Tenant created: ${name} (${slug})`);

        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error creating tenant:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ERROR', message: 'Failed to create tenant' }
        });
    }
};

// Update tenant
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, max_domains, max_users, storage_quota_mb, status } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name) { updates.push(`name = $${paramIndex++}`); params.push(name); }
        if (storage_quota_mb) { updates.push(`storage_quota_mb = $${paramIndex++}`); params.push(storage_quota_mb); }
        if (max_domains) { updates.push(`max_domains = $${paramIndex++}`); params.push(max_domains); }
        if (max_users) { updates.push(`max_users = $${paramIndex++}`); params.push(max_users); }
        if (status) { updates.push(`status = $${paramIndex++}`); params.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_UPDATES', message: 'No fields to update' }
            });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const result = await pool.query(`
            UPDATE tenants 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex} AND deleted_at IS NULL
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Tenant not found' }
            });
        }

        logger.info(`Tenant updated: ${id}`);
        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error updating tenant:', error);
        res.status(500).json({
            success: false,
            error: { code: 'UPDATE_ERROR', message: 'Failed to update tenant' }
        });
    }
};

// Delete tenant (soft delete)
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE tenants 
            SET deleted_at = NOW(), status = 'deleted'
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, name
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Tenant not found' }
            });
        }

        logger.info(`Tenant deleted: ${result.rows[0].name} (${id})`);
        res.json({ success: true, message: 'Tenant deleted successfully' });

    } catch (error) {
        logger.error('Error deleting tenant:', error);
        res.status(500).json({
            success: false,
            error: { code: 'DELETE_ERROR', message: 'Failed to delete tenant' }
        });
    }
};
