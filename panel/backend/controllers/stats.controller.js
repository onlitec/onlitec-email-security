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

        // Total emails today
        const emailsToday = await pool.query(`
            SELECT COALESCE(SUM(total_received), 0) as total
            FROM daily_stats 
            WHERE date = CURRENT_DATE
        `);
        stats.emailsToday = parseInt(emailsToday.rows[0]?.total || 0);

        // Spam blocked today (using total_spam column)
        const spamBlocked = await pool.query(`
            SELECT COALESCE(SUM(total_spam), 0) as total
            FROM daily_stats 
            WHERE date = CURRENT_DATE
        `);
        stats.spamBlocked = parseInt(spamBlocked.rows[0]?.total || 0);

        // Virus detected this week (using total_virus column)
        const virusDetected = await pool.query(`
            SELECT COALESCE(SUM(total_virus), 0) as total
            FROM daily_stats 
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        `);
        stats.virusDetected = parseInt(virusDetected.rows[0]?.total || 0);

        // Active tenants
        const activeTenants = await pool.query(`
            SELECT COUNT(*) as total
            FROM tenants 
            WHERE status = 'active'
        `);
        stats.activeTenants = parseInt(activeTenants.rows[0]?.total || 0);

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

        // Stats trend (last 7 days) - using actual column names
        const trend = await pool.query(`
            SELECT 
                date,
                COALESCE(total_received, 0) as received,
                COALESCE(total_sent, 0) as delivered,
                COALESCE(total_spam, 0) as spam,
                COALESCE(total_virus, 0) as virus
            FROM daily_stats 
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY date ASC
        `);
        stats.trend = trend.rows;

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
