const { Pool } = require('pg');
const { createClient } = require('redis');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// Redis client for blacklist cache
let redisClient;
const getRedis = async () => {
    if (!redisClient || !redisClient.isOpen) {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'onlitec_redis',
                port: process.env.REDIS_PORT || 6379
            }
        });
        redisClient.on('error', (err) => logger.error('Redis error:', err));
        await redisClient.connect();
    }
    return redisClient;
};

/**
 * Sync blacklist from PostgreSQL to Redis
 * Called after adding/removing entries or periodically
 */
const syncBlacklistToRedis = async (tenantId = null) => {
    try {
        const redis = await getRedis();

        let query = 'SELECT tenant_id, type, value FROM blacklist';
        const params = [];

        if (tenantId) {
            query += ' WHERE tenant_id = $1';
            params.push(tenantId);
        }

        const result = await pool.query(query, params);

        // Set keys in Redis with TTL of 1 hour (refreshed on next sync)
        for (const row of result.rows) {
            const key = `blacklist:${row.tenant_id}:${row.type}:${row.value.toLowerCase()}`;
            await redis.set(key, '1', { EX: 3600 }); // 1 hour TTL

            // Also set global key for faster lookups
            const globalKey = `blacklist:global:${row.type}:${row.value.toLowerCase()}`;
            await redis.set(globalKey, row.tenant_id, { EX: 3600 });
        }

        logger.info(`Synced ${result.rows.length} blacklist entries to Redis`);
        return result.rows.length;
    } catch (error) {
        logger.error('Redis sync error:', error);
        throw error;
    }
};

// Auto-blacklist thresholds
const THRESHOLDS = {
    AUTO_BLACKLIST_SCORE: 20,      // RSPAMD score to trigger auto-blacklist
    AUTO_BLACKLIST_VIRUS: true,    // Always blacklist virus senders
    AUTO_BLACKLIST_PHISHING: true, // Blacklist AI-detected phishing
    REPEAT_OFFENDER_COUNT: 5       // Rejections before blacklisting email
};

/**
 * Auto-add to blacklist based on RSPAMD/AI detection
 * Called by RSPAMD metadata_exporter webhook
 */
exports.autoAdd = async (req, res) => {
    try {
        const {
            sender,           // From address
            sender_domain,    // Domain part
            ip,               // Client IP
            score,            // RSPAMD score
            action,           // reject, add_header, etc
            symbols,          // RSPAMD symbols triggered
            ai_label,         // AI classification
            ai_confidence,    // AI confidence
            recipient_domain  // For tenant lookup
        } = req.body;

        // Only process rejected emails
        if (action !== 'reject') {
            return res.json({ success: true, action: 'skipped', reason: 'not rejected' });
        }

        // Get tenant from recipient domain
        const tenantResult = await pool.query(
            `SELECT t.id FROM tenants t 
             JOIN domains d ON d.tenant_id = t.id 
             WHERE d.domain = $1 AND t.status = 'active' LIMIT 1`,
            [recipient_domain]
        );

        let tenant_id;
        if (tenantResult.rows.length === 0) {
            // Use default tenant
            const defaultTenant = await pool.query('SELECT id FROM tenants WHERE status = $1 LIMIT 1', ['active']);
            if (defaultTenant.rows.length === 0) {
                return res.status(400).json({ success: false, error: 'No active tenant' });
            }
            tenant_id = defaultTenant.rows[0].id;
        } else {
            tenant_id = tenantResult.rows[0].id;
        }

        // Determine source and what to blacklist
        let source = 'auto_rspamd';
        let shouldBlacklist = false;
        let blacklistType = 'domain';
        let blacklistValue = sender_domain;
        let reason = `Auto-blacklisted: RSPAMD score ${score}`;

        // Check virus symbols
        const hasVirus = symbols && (
            symbols.includes('CLAM_VIRUS') ||
            symbols.includes('CLAMAV_VIRUS') ||
            symbols.includes('VIRUS')
        );

        if (hasVirus) {
            source = 'auto_virus';
            shouldBlacklist = true;
            blacklistType = 'ip';
            blacklistValue = ip;
            reason = 'Auto-blacklisted: Virus detected';
        }
        // Check AI phishing detection
        else if (ai_label === 'phishing' && ai_confidence >= 0.7) {
            source = 'auto_ai';
            shouldBlacklist = true;
            blacklistType = 'domain';
            blacklistValue = sender_domain;
            reason = `Auto-blacklisted: AI phishing (${Math.round(ai_confidence * 100)}%)`;
        }
        // Check high RSPAMD score
        else if (score >= THRESHOLDS.AUTO_BLACKLIST_SCORE) {
            shouldBlacklist = true;
            blacklistType = 'domain';
            blacklistValue = sender_domain;
            reason = `Auto-blacklisted: High spam score (${score})`;
        }

        // Track sender in temporary Redis-like counter (using database for simplicity)
        const senderKey = sender?.toLowerCase();
        if (senderKey && !shouldBlacklist) {
            // Check existing entry and increment counter
            const existing = await pool.query(
                'SELECT id, spam_count FROM blacklist WHERE tenant_id = $1 AND type = $2 AND value = $3',
                [tenant_id, 'email', senderKey]
            );

            if (existing.rows.length > 0) {
                const newCount = existing.rows[0].spam_count + 1;
                await pool.query(
                    'UPDATE blacklist SET spam_count = $1, last_seen = NOW() WHERE id = $2',
                    [newCount, existing.rows[0].id]
                );

                if (newCount >= THRESHOLDS.REPEAT_OFFENDER_COUNT) {
                    shouldBlacklist = true;
                    blacklistType = 'email';
                    blacklistValue = senderKey;
                    reason = `Auto-blacklisted: Repeat offender (${newCount} rejections)`;
                }
            }
        }

        // Add to blacklist if criteria met
        if (shouldBlacklist && blacklistValue) {
            // Check if already exists
            const existing = await pool.query(
                'SELECT id, spam_count FROM blacklist WHERE tenant_id = $1 AND type = $2 AND value = $3',
                [tenant_id, blacklistType, blacklistValue]
            );

            if (existing.rows.length > 0) {
                // Update existing
                await pool.query(
                    'UPDATE blacklist SET spam_count = spam_count + 1, last_seen = NOW() WHERE id = $1',
                    [existing.rows[0].id]
                );
                logger.info(`Auto-blacklist updated: ${blacklistType}:${blacklistValue} (${source})`);
            } else {
                // Insert new
                await pool.query(
                    `INSERT INTO blacklist (tenant_id, type, value, comment, source, spam_count, last_seen)
                     VALUES ($1, $2, $3, $4, $5, 1, NOW())
                     ON CONFLICT (tenant_id, type, value) DO UPDATE SET spam_count = blacklist.spam_count + 1, last_seen = NOW()`,
                    [tenant_id, blacklistType, blacklistValue, reason, source]
                );
                logger.info(`Auto-blacklist added: ${blacklistType}:${blacklistValue} (${source})`);

                // Sync to Redis for RSPAMD lookups (non-blocking)
                syncBlacklistToRedis(tenant_id).catch(err => logger.error('Redis sync failed:', err));
            }

            return res.json({
                success: true,
                action: 'blacklisted',
                type: blacklistType,
                value: blacklistValue,
                source: source,
                reason: reason
            });
        }

        res.json({ success: true, action: 'tracked', reason: 'Below threshold' });

    } catch (error) {
        logger.error('Auto-blacklist error:', error);
        res.status(500).json({ success: false, error: 'Auto-blacklist failed' });
    }
};

/**
 * Sync blacklist to Redis endpoint
 */
exports.sync = async (req, res) => {
    try {
        const count = await syncBlacklistToRedis();
        res.json({ success: true, synced: count });
    } catch (error) {
        logger.error('Sync error:', error);
        res.status(500).json({ success: false, error: 'Sync failed' });
    }
};

/**
 * Get auto-blacklist statistics
 */
exports.stats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                source,
                type,
                COUNT(*) as count,
                SUM(spam_count) as total_hits
            FROM blacklist
            WHERE source != 'manual'
            GROUP BY source, type
            ORDER BY count DESC
        `);

        const recentResult = await pool.query(`
            SELECT type, value, source, spam_count, last_seen, comment
            FROM blacklist
            WHERE source != 'manual'
            ORDER BY last_seen DESC
            LIMIT 20
        `);

        res.json({
            success: true,
            stats: result.rows,
            recent: recentResult.rows
        });

    } catch (error) {
        logger.error('Auto-blacklist stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
};

/**
 * Clean old auto-blacklist entries
 * Call this via cron job
 */
exports.cleanup = async (req, res) => {
    try {
        // Remove auto entries older than 30 days with low spam count
        const result = await pool.query(`
            DELETE FROM blacklist
            WHERE source != 'manual'
            AND last_seen < NOW() - INTERVAL '30 days'
            AND spam_count < 3
            RETURNING id
        `);

        logger.info(`Auto-blacklist cleanup: removed ${result.rowCount} entries`);
        res.json({ success: true, removed: result.rowCount });

    } catch (error) {
        logger.error('Auto-blacklist cleanup error:', error);
        res.status(500).json({ success: false, error: 'Cleanup failed' });
    }
};
