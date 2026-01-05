const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// Get dashboard statistics
exports.getStats = async (req, res) => {
    try {
        const stats = {};

        // Total emails today (from mail_logs)
        const emailsToday = await pool.query(`
            SELECT COUNT(*) as total
            FROM mail_logs 
            WHERE created_at >= CURRENT_DATE
        `);
        stats.emailsToday = parseInt(emailsToday.rows[0]?.total || 0);

        // Spam blocked today (from mail_logs where is_spam = true or status = rejected)
        const spamBlocked = await pool.query(`
            SELECT COUNT(*) as total
            FROM mail_logs 
            WHERE created_at >= CURRENT_DATE
            AND (is_spam = true OR status = 'rejected' OR spam_score > 15)
        `);
        stats.spamBlocked = parseInt(spamBlocked.rows[0]?.total || 0);

        // Virus detected this week (from mail_logs)
        // Includes: 
        // 1. Emails with status = 'virus' (traditional virus detection)
        // 2. Emails with is_virus = true
        // 3. Emails blocked by spam/phishing (from AI) that have attachments
        const virusDetected = await pool.query(`
            SELECT COUNT(*) as total
            FROM mail_logs ml
            LEFT JOIN ai_verdicts av ON av.mail_log_id = ml.id
            WHERE ml.created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND (
                -- Traditional virus detection
                ml.status = 'virus' 
                OR ml.is_virus = true
                -- Spam/Phishing with attachments treated as virus threat
                OR (
                    ml.has_attachment = true 
                    AND (
                        ml.is_spam = true 
                        OR ml.status = 'rejected'
                        OR av.ai_label IN ('phishing', 'fraud', 'spam')
                    )
                )
            )
        `);
        stats.virusDetected = parseInt(virusDetected.rows[0]?.total || 0);

        // Active tenants
        const activeTenants = await pool.query(`
            SELECT COUNT(*) as total
            FROM tenants 
            WHERE status = 'active'
        `);
        stats.activeTenants = parseInt(activeTenants.rows[0]?.total || 0);

        // Total tenants
        const totalTenants = await pool.query(`
            SELECT COUNT(*) as total
            FROM tenants
        `);
        stats.totalTenants = parseInt(totalTenants.rows[0]?.total || 0);

        // Total domains
        const totalDomains = await pool.query(`
            SELECT COUNT(*) as total
            FROM domains 
            WHERE deleted_at IS NULL
        `);
        stats.totalDomains = parseInt(totalDomains.rows[0]?.total || 0);

        // Total users
        const totalUsers = await pool.query(`
            SELECT COUNT(*) as total
            FROM users 
            WHERE deleted_at IS NULL
        `);
        stats.totalUsers = parseInt(totalUsers.rows[0]?.total || 0);

        // Quarantined emails
        const quarantined = await pool.query(`
            SELECT COUNT(*) as total
            FROM quarantine 
            WHERE status = 'quarantined'
        `);
        stats.quarantinedEmails = parseInt(quarantined.rows[0]?.total || 0);

        // Recent activity (last 5 mail logs)
        const recentActivity = await pool.query(`
            SELECT id, from_address as sender, to_address as recipient, subject, status, created_at
            FROM mail_logs 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        stats.recentActivity = recentActivity.rows;

        // Stats trend (last 7 days) - aggregate from mail_logs
        // Updated to include spam/phishing with attachments as virus detections
        const trend = await pool.query(`
            SELECT 
                DATE(ml.created_at) as date,
                COUNT(*) as received,
                SUM(CASE WHEN ml.status IN ('delivered', 'accepted') THEN 1 ELSE 0 END) as delivered,
                SUM(CASE 
                    WHEN ml.is_spam = true OR ml.status = 'rejected' OR ml.spam_score > 15 
                    THEN 1 ELSE 0 
                END) as spam,
                SUM(CASE 
                    WHEN ml.status = 'virus' 
                        OR ml.is_virus = true
                        OR (ml.has_attachment = true AND (
                            ml.is_spam = true 
                            OR ml.status = 'rejected'
                            OR av.ai_label IN ('phishing', 'fraud', 'spam')
                        ))
                    THEN 1 ELSE 0 
                END) as virus
            FROM mail_logs ml
            LEFT JOIN ai_verdicts av ON av.mail_log_id = ml.id
            WHERE ml.created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(ml.created_at)
            ORDER BY date ASC
        `);

        // Convert bigint strings to numbers for frontend compatibility
        stats.trend = trend.rows.map(row => ({
            date: row.date,
            received: parseInt(row.received) || 0,
            delivered: parseInt(row.delivered) || 0,
            spam: parseInt(row.spam) || 0,
            virus: parseInt(row.virus) || 0
        }));

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATS_ERROR',
                message: 'Failed to fetch statistics'
            }
        });
    }
};

// Get stats for a specific tenant
exports.getTenantStats = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const stats = await pool.query(`
            SELECT 
                COALESCE(SUM(total_received), 0) as total_received,
                COALESCE(SUM(total_delivered), 0) as total_delivered,
                COALESCE(SUM(spam_blocked), 0) as spam_blocked,
                COALESCE(SUM(virus_detected), 0) as virus_detected
            FROM daily_stats 
            WHERE tenant_id = $1 
            AND date >= CURRENT_DATE - INTERVAL '30 days'
        `, [tenantId]);

        res.json({
            success: true,
            data: stats.rows[0] || {}
        });

    } catch (error) {
        logger.error('Error fetching tenant stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'TENANT_STATS_ERROR',
                message: 'Failed to fetch tenant statistics'
            }
        });
    }
};
