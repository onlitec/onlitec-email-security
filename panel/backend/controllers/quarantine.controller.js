const { Pool } = require('pg');
const logger = require('../config/logger');
const nodemailer = require('nodemailer');
const { getRedisClient } = require('../config/redis');

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
            SELECT q.id, q.from_address as sender, q.to_address as recipient, q.subject, 
                   q.reason, q.spam_score as score,
                   q.status, q.reason as quarantine_type, q.size_bytes, q.created_at,
                   t.name as tenant_name
            FROM quarantine q
            LEFT JOIN tenants t ON q.tenant_id = t.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) { query += ` AND q.status = $${paramIndex++}`; params.push(status); }
        if (type) { query += ` AND q.reason = $${paramIndex++}`; params.push(type); }
        if (search) {
            query += ` AND (q.from_address ILIKE $${paramIndex} OR q.to_address ILIKE $${paramIndex} OR q.subject ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (date_from) { query += ` AND q.created_at >= $${paramIndex++}`; params.push(date_from); }
        if (date_to) { query += ` AND q.created_at <= $${paramIndex++}`; params.push(date_to); }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

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

// Helper to deliver email via SMTP
const deliverEmail = async (emailData) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.POSTFIX_HOST || 'onlitec_postfix',
            port: 25,
            secure: false,
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: emailData.sender,
            to: emailData.recipient,
            subject: emailData.subject,
            html: emailData.body,
            headers: emailData.headers ? JSON.parse(emailData.headers) : {}
        });

        logger.info(`Email delivered via SMTP: ${emailData.id}`);
        return true;
    } catch (error) {
        logger.error(`Failed to deliver email ${emailData.id}:`, error);
        throw error;
    }
};

// Release email from quarantine
exports.release = async (req, res) => {
    try {
        const { id } = req.params;

        // Get email content first
        const searchResult = await pool.query(`SELECT * FROM quarantine WHERE id = $1`, [id]);
        if (searchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Email not found' } });
        }

        const emailData = searchResult.rows[0];
        if (emailData.status !== 'quarantined') {
            return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email is not in quarantine' } });
        }

        // Deliver
        await deliverEmail({
            id: emailData.id,
            sender: emailData.from_address,
            recipient: emailData.to_address,
            subject: emailData.subject,
            body: emailData.body,
            headers: emailData.headers
        });

        // Note: released_by set to NULL because admin_users IDs are not in users table
        const result = await pool.query(`
            UPDATE quarantine 
            SET status = 'released', released_at = NOW(), released_by = NULL
            WHERE id = $1
            RETURNING id, from_address as sender, to_address as recipient, subject
        `, [id]);

        logger.info(`Email released from quarantine: ${id} by ${req.user?.email || 'system'}`);
        res.json({ success: true, message: 'Email released and delivered successfully', data: result.rows[0] });

    } catch (error) {
        logger.error('Error releasing email:', error);
        res.status(500).json({ success: false, error: { code: 'RELEASE_ERROR', message: 'Failed to release email' } });
    }
};

// Approve email: Release + Whitelist
exports.approve = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get email info
        const qRes = await pool.query('SELECT * FROM quarantine WHERE id = $1', [id]);
        if (qRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Email not found' });
        const email = qRes.rows[0];

        // 2. Deliver and Release (call internal logic)
        await deliverEmail({
            id: email.id,
            sender: email.from_address,
            recipient: email.to_address,
            subject: email.subject,
            body: email.body,
            headers: email.headers
        });

        // Note: released_by set to NULL because admin_users IDs are not in users table
        await pool.query(`UPDATE quarantine SET status = 'released', released_at = NOW(), released_by = NULL WHERE id = $1`,
            [id]);

        // 3. Add to Whitelist
        const sender = email.from_address;
        const tenant_id = email.tenant_id;

        const checkRes = await pool.query('SELECT id FROM whitelist WHERE tenant_id = $1 AND type = $2 AND value = $3',
            [tenant_id, 'email', sender]);

        if (checkRes.rows.length === 0) {
            await pool.query('INSERT INTO whitelist (tenant_id, type, value, comment) VALUES ($1, $2, $3, $4)',
                [tenant_id, 'email', sender, 'Auto-whitelisted via approval']);

            // Sync to Redis
            try {
                const redis = await getRedisClient();
                const redisKey = `tenant:${tenant_id}:whitelist:email:${sender.toLowerCase()}`;
                await redis.set(redisKey, '1');
            } catch (re) { logger.error('Redis sync error:', re); }
        }

        res.json({ success: true, message: 'Email approved, delivered and sender whitelisted' });
    } catch (error) {
        logger.error('Error approving email:', error);
        res.status(500).json({ success: false, message: 'Failed to approve email' });
    }
};

// Reject email: Delete/Reject + Blacklist
exports.reject = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get email info
        const qRes = await pool.query('SELECT * FROM quarantine WHERE id = $1', [id]);
        if (qRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Email not found' });
        const email = qRes.rows[0];

        // 2. Update status to reported/deleted
        await pool.query(`UPDATE quarantine SET status = 'reported', deleted_at = NOW() WHERE id = $1`, [id]);

        // 3. Add to Blacklist
        const sender = email.from_address;
        const tenant_id = email.tenant_id;

        const checkRes = await pool.query('SELECT id FROM blacklist WHERE tenant_id = $1 AND type = $2 AND value = $3',
            [tenant_id, 'email', sender]);

        if (checkRes.rows.length === 0) {
            await pool.query('INSERT INTO blacklist (tenant_id, type, value, comment) VALUES ($1, $2, $3, $4)',
                [tenant_id, 'email', sender, 'Auto-blacklisted via rejection']);

            // Sync to Redis
            try {
                const redis = await getRedisClient();
                const redisKey = `blacklist:${tenant_id}:email:${sender.toLowerCase()}`;
                await redis.set(redisKey, '1');
            } catch (re) { logger.error('Redis sync error:', re); }
        }

        res.json({ success: true, message: 'Email rejected and sender blacklisted' });
    } catch (error) {
        logger.error('Error rejecting email:', error);
        res.status(500).json({ success: false, message: 'Failed to reject email' });
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

        // Get emails to deliver
        const searchResult = await pool.query(`
            SELECT * FROM quarantine WHERE id = ANY($1) AND status = 'quarantined'
        `, [ids]);

        const emails = searchResult.rows;
        let successCount = 0;
        let errorCount = 0;

        for (const emailData of emails) {
            try {
                // Add a header to indicate this is a released email to help Rspamd bypass if needed
                const headers = emailData.headers ? JSON.parse(emailData.headers) : {};
                headers['X-Onlitec-Released'] = 'true';

                await deliverEmail({
                    id: emailData.id,
                    sender: emailData.from_address,
                    recipient: emailData.to_address,
                    subject: emailData.subject,
                    body: emailData.body,
                    headers: JSON.stringify(headers)
                });

                await pool.query(`
                    UPDATE quarantine 
                    SET status = 'released', released_at = NOW(), released_by = $2
                    WHERE id = $1
                `, [emailData.id, req.user?.userId || 'admin-system']);

                successCount++;
            } catch (error) {
                logger.error(`Failed to deliver email ${emailData.id} in bulk release:`, error);
                errorCount++;
            }
        }

        logger.info(`Bulk release: ${successCount} emails delivered, ${errorCount} failed`);
        res.json({
            success: true,
            message: `${successCount} emails released and delivered successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
            data: { successCount, errorCount }
        });

    } catch (error) {
        logger.error('Error bulk releasing:', error);
        res.status(500).json({ success: false, error: { code: 'BULK_ERROR', message: 'Failed to release emails' } });
    }
};

// Ingest quarantined email from Rspamd
exports.ingest = async (req, res) => {
    try {
        const {
            tenant_id,
            message_id,
            from_address,
            to_address,
            subject,
            size_bytes,
            reason,
            spam_score,
            body,
            headers
        } = req.body;

        if (!tenant_id || !message_id) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const result = await pool.query(`
            INSERT INTO quarantine (
                tenant_id, message_id, from_address, to_address, subject, 
                size_bytes, reason, spam_score, body, headers, status, created_at, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'quarantined', NOW(), NOW() + INTERVAL '30 days')
            RETURNING id
        `, [
            tenant_id,
            message_id,
            from_address,
            to_address,
            subject,
            size_bytes || 0,
            reason || 'spam',
            spam_score || 0,
            body || '',
            typeof headers === 'object' ? JSON.stringify(headers) : (headers || '{}')
        ]);

        logger.info(`Email ingested into quarantine: ${result.rows[0].id} (MsgID: ${message_id})`);
        res.status(201).json({ success: true, id: result.rows[0].id });

    } catch (error) {
        logger.error('Error ingesting into quarantine:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
