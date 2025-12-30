const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const logger = require('../config/logger');
const { authenticateToken } = require('../middleware/auth.middleware');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'emailprotect',
    user: process.env.POSTGRES_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || 'changeme123'
});

// Helper to convert numeric fields
const convertVerdict = (row) => ({
    ...row,
    ai_confidence: row.ai_confidence ? parseFloat(row.ai_confidence) : 0,
    ai_score: row.ai_score ? parseFloat(row.ai_score) : 0,
    pdf_risk_score: row.pdf_risk_score ? parseFloat(row.pdf_risk_score) : 0,
    url_max_score: row.url_max_score ? parseFloat(row.url_max_score) : 0,
    total_score: row.total_score ? parseFloat(row.total_score) : 0
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/ai/verdicts - List AI verdicts with pagination
router.get('/verdicts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const label = req.query.label; // Filter by label
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        let query = `
            SELECT 
                id, message_id, subject, sender, recipient,
                ai_label, ai_confidence, ai_score, ai_reasons,
                pdf_has_js, pdf_has_links, pdf_risk_score,
                url_max_risk, url_max_score,
                final_action, total_score, processed_at
            FROM ai_verdicts
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (label) {
            paramCount++;
            query += ` AND ai_label = $${paramCount}`;
            params.push(label);
        }

        if (dateFrom) {
            paramCount++;
            query += ` AND processed_at >= $${paramCount}`;
            params.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            query += ` AND processed_at <= $${paramCount}`;
            params.push(dateTo);
        }

        query += ` ORDER BY processed_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM ai_verdicts WHERE 1=1';
        const countParams = [];

        if (label) {
            countQuery += ' AND ai_label = $1';
            countParams.push(label);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                verdicts: result.rows.map(convertVerdict),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching AI verdicts:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch AI verdicts' }
        });
    }
});

// GET /api/ai/verdicts/stats - Get statistics
router.get('/verdicts/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ai_label = 'phishing') as phishing,
                COUNT(*) FILTER (WHERE ai_label = 'fraud') as fraud,
                COUNT(*) FILTER (WHERE ai_label = 'spam') as spam,
                COUNT(*) FILTER (WHERE ai_label = 'legit') as legit,
                COUNT(*) FILTER (WHERE pdf_has_js = true) as pdf_with_js,
                COUNT(*) FILTER (WHERE url_max_risk IN ('critical', 'high')) as risky_urls,
                AVG(ai_score) as avg_ai_score,
                AVG(total_score) as avg_total_score
            FROM ai_verdicts
            WHERE processed_at >= CURRENT_DATE - INTERVAL '7 days'
        `);

        const dailyStats = await pool.query(`
            SELECT 
                DATE(processed_at) as date,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ai_label = 'phishing') as phishing,
                COUNT(*) FILTER (WHERE ai_label = 'spam') as spam,
                COUNT(*) FILTER (WHERE ai_label = 'legit') as legit
            FROM ai_verdicts
            WHERE processed_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(processed_at)
            ORDER BY date DESC
        `);

        // Convert string counts to numbers
        const summary = stats.rows[0];
        const convertedSummary = {
            total: parseInt(summary.total) || 0,
            phishing: parseInt(summary.phishing) || 0,
            fraud: parseInt(summary.fraud) || 0,
            spam: parseInt(summary.spam) || 0,
            legit: parseInt(summary.legit) || 0,
            pdf_with_js: parseInt(summary.pdf_with_js) || 0,
            risky_urls: parseInt(summary.risky_urls) || 0,
            avg_ai_score: parseFloat(summary.avg_ai_score) || 0,
            avg_total_score: parseFloat(summary.avg_total_score) || 0
        };

        res.json({
            success: true,
            data: {
                summary: convertedSummary,
                daily: dailyStats.rows.map(row => ({
                    date: row.date,
                    total: parseInt(row.total) || 0,
                    phishing: parseInt(row.phishing) || 0,
                    spam: parseInt(row.spam) || 0,
                    legit: parseInt(row.legit) || 0
                }))
            }
        });
    } catch (error) {
        logger.error('Error fetching AI stats:', error);
        res.status(500).json({
            success: false,
            error: { code: 'STATS_ERROR', message: 'Failed to fetch AI statistics' }
        });
    }
});

// GET /api/ai/verdicts/:id - Get single verdict details
router.get('/verdicts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM ai_verdicts WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Verdict not found' }
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching verdict:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch verdict' }
        });
    }
});

// POST /api/ai/verdicts - Store new verdict (called by Rspamd)
router.post('/verdicts', async (req, res) => {
    try {
        const {
            message_id, subject, sender, recipient,
            ai_label, ai_confidence, ai_score, ai_reasons,
            pdf_has_js, pdf_has_links, pdf_risk_score, pdf_urls,
            url_max_risk, url_max_score, url_risky_urls,
            final_action, total_score, tenant_id
        } = req.body;

        const result = await pool.query(`
            INSERT INTO ai_verdicts (
                message_id, subject, sender, recipient,
                ai_label, ai_confidence, ai_score, ai_reasons,
                pdf_has_js, pdf_has_links, pdf_risk_score, pdf_urls,
                url_max_risk, url_max_score, url_risky_urls,
                final_action, total_score, tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
        `, [
            message_id, subject, sender, recipient,
            ai_label, ai_confidence, ai_score, ai_reasons,
            pdf_has_js, pdf_has_links, pdf_risk_score, pdf_urls,
            url_max_risk, url_max_score, url_risky_urls,
            final_action, total_score, tenant_id
        ]);

        res.json({
            success: true,
            data: { id: result.rows[0].id }
        });
    } catch (error) {
        logger.error('Error storing verdict:', error);
        res.status(500).json({
            success: false,
            error: { code: 'STORE_ERROR', message: 'Failed to store verdict' }
        });
    }
});

module.exports = router;
