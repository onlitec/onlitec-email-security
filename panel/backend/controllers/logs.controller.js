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
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

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

        // Convert PostgreSQL bigint (returned as string) to JavaScript numbers
        const byStatusData = stats.rows.map(row => ({
            status: row.status,
            count: parseInt(row.count) || 0
        }));

        const timelineData = timeline.rows.map(row => ({
            date: row.date,
            total: parseInt(row.total) || 0,
            delivered: parseInt(row.delivered) || 0,
            rejected: parseInt(row.rejected) || 0,
            quarantined: parseInt(row.quarantined) || 0
        }));

        res.json({
            success: true,
            data: {
                byStatus: byStatusData,
                timeline: timelineData
            }
        });

    } catch (error) {
        logger.error('Error getting log stats:', error);
        res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: 'Failed to get stats' } });
    }
};
// Ingest logs from Rspamd
exports.ingest = async (req, res) => {
    try {
        const logs = Array.isArray(req.body) ? req.body : [req.body];

        for (const log of logs) {
            // Map Rspamd JSON to DB columns
            // Rspamd sends: { message_id, from, rcpt, subject, size, action, score, symbols, ip, ... }
            /* 
               Note: Rspamd field names might vary depending on configuration. 
               We expect a custom formatted JSON or we adapt here.
               For now, let's map what we usually get from metadata_exporter with template,
               OR simplified mapping if we use the default JSON output.
            */

            const message_id = log.message_id || log['Message-ID'] || 'unknown';
            const from_address = log.from || log.sender || '';
            const to_address = log.rcpt || log.recipient || (Array.isArray(log.recipients) ? log.recipients[0] : '');
            const subject = log.subject || '';
            const size_bytes = log.size || 0;
            const direction = 'inbound'; // Default for now
            const status = log.action === 'reject' ? 'rejected' : 'accepted';
            const spam_score = log.score || 0;
            const is_spam = spam_score > 15 || log.action === 'reject';
            const tenant_id = log.tenant_id || 'c3f5a2bf-d447-4729-95f9-61215bdf5275'; // Fallback to ONLITEC

            const logResult = await pool.query(`
                INSERT INTO mail_logs (
                    tenant_id, message_id, from_address, to_address, subject, 
                    size_bytes, direction, status, spam_score, is_spam, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                RETURNING id
            `, [
                tenant_id, message_id, from_address, to_address, subject,
                size_bytes, direction, status, spam_score, is_spam
            ]);

            const logId = logResult.rows[0].id;

            // Process AI Symbols if present
            const rawSymbols = log.symbols || [];
            const symbols = {};

            // Normalize symbols to map { NAME: symbolObject }
            if (Array.isArray(rawSymbols)) {
                rawSymbols.forEach(s => symbols[s.name] = s);
            } else if (typeof rawSymbols === 'object') {
                Object.assign(symbols, rawSymbols);
            }

            logger.info('INSPECT SYMBOLS (Normalised):', JSON.stringify(symbols));

            let aiLabel = null;
            let aiScore = 0;
            let aiConfidence = 0;
            let aiReasons = [];

            if (symbols['AI_PHISHING']) {
                aiLabel = 'phishing';
                aiScore = symbols['AI_PHISHING'].score || 15;
                aiConfidence = 0.95;
                if (symbols['AI_PHISHING'].options) aiReasons = symbols['AI_PHISHING'].options;
            } else if (symbols['AI_FRAUD']) {
                aiLabel = 'fraud';
                aiScore = symbols['AI_FRAUD'].score || 12;
                aiConfidence = 0.90;
                if (symbols['AI_FRAUD'].options) aiReasons = symbols['AI_FRAUD'].options;
            } else if (symbols['AI_SPAM']) {
                aiLabel = 'spam';
                aiScore = symbols['AI_SPAM'].score || 8;
                aiConfidence = 0.85;
                if (symbols['AI_SPAM'].options) aiReasons = symbols['AI_SPAM'].options;
            } else if (symbols['AI_LEGIT']) {
                aiLabel = 'legit';
                aiScore = symbols['AI_LEGIT'].score || 0;
                aiConfidence = 0.99;
                if (symbols['AI_LEGIT'].options) aiReasons = symbols['AI_LEGIT'].options;
            }

            if (aiLabel) {
                await pool.query(
                    `INSERT INTO ai_verdicts (mail_log_id, ai_label, ai_score, ai_confidence, ai_reasons)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [logId, aiLabel, aiScore, aiConfidence, JSON.stringify(aiReasons)]
                );
            }
        }

        res.json({ success: true, count: logs.length });

    } catch (error) {
        logger.error('Error ingesting logs:', error);
        res.status(500).json({ success: false, error: { code: 'INGEST_ERROR', message: 'Failed to ingest logs' } });
    }
};
