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
                av.id, av.ai_label, av.ai_confidence, av.ai_score, av.ai_reasons, av.created_at as processed_at,
                ml.id as mail_log_id, ml.message_id, ml.subject, ml.from_address as sender, ml.to_address as recipient,
                ml.status as final_action, ml.spam_score as total_score,
                q.id as quarantine_id
            FROM ai_verdicts av
            JOIN mail_logs ml ON av.mail_log_id = ml.id
            LEFT JOIN quarantine q ON ml.message_id = q.message_id AND q.status = 'quarantined'
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (label) {
            paramCount++;
            query += ` AND av.ai_label = $${paramCount}`;
            params.push(label);
        }

        if (dateFrom) {
            paramCount++;
            query += ` AND av.created_at >= $${paramCount}`;
            params.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            query += ` AND av.created_at <= $${paramCount}`;
            params.push(dateTo);
        }

        query += ` ORDER BY av.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM ai_verdicts av WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (label) {
            countQuery += ` AND av.ai_label = $${countParamIndex}`;
            countParams.push(label);
            countParamIndex++;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                verdicts: result.rows.map(row => ({
                    ...row,
                    ai_confidence: parseFloat(row.ai_confidence),
                    ai_score: parseFloat(row.ai_score),
                    total_score: parseFloat(row.total_score || 0)
                })),
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
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch AI verdicts: ' + error.message }
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
                AVG(ai_score) as avg_ai_score
            FROM ai_verdicts
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        `);

        const dailyStats = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ai_label = 'phishing') as phishing,
                COUNT(*) FILTER (WHERE ai_label = 'spam') as spam,
                COUNT(*) FILTER (WHERE ai_label = 'legit') as legit
            FROM ai_verdicts
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
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
            avg_ai_score: parseFloat(summary.avg_ai_score) || 0
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
        const result = await pool.query(`
            SELECT 
                av.id, av.ai_label, av.ai_confidence, av.ai_score, av.ai_reasons, av.created_at as processed_at,
                ml.id as mail_log_id, ml.message_id, ml.subject, ml.from_address as sender, ml.to_address as recipient,
                ml.status as final_action, ml.spam_score as total_score,
                q.id as quarantine_id
            FROM ai_verdicts av
            JOIN mail_logs ml ON av.mail_log_id = ml.id
            LEFT JOIN quarantine q ON ml.message_id = q.message_id AND q.status = 'quarantined'
            WHERE av.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Verdict not found' }
            });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                ...row,
                ai_confidence: parseFloat(row.ai_confidence),
                ai_score: parseFloat(row.ai_score),
                total_score: parseFloat(row.total_score || 0)
            }
        });
    } catch (error) {
        logger.error('Error fetching verdict:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_ERROR', message: 'Failed to fetch verdict' }
        });
    }
});

module.exports = router;
