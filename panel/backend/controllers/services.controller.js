const { Pool } = require('pg');
const net = require('net');
const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const logger = require('../config/logger');

const execPromise = util.promisify(exec);

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// Helper: TCP ping a service
const tcpPing = (host, port, timeout = 3000) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            resolved = true;
            socket.destroy();
            resolve({ online: true, responseTime: Date.now() });
        });

        socket.on('timeout', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve({ online: false, error: 'Connection timeout' });
            }
        });

        socket.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve({ online: false, error: err.message });
            }
        });

        const startTime = Date.now();
        socket.connect(port, host);
    });
};

// Helper: HTTP GET request
const httpGet = (url, timeout = 3000) => {
    return new Promise((resolve) => {
        const request = http.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ online: true, statusCode: res.statusCode, data });
            });
        });

        request.on('timeout', () => {
            request.destroy();
            resolve({ online: false, error: 'Request timeout' });
        });

        request.on('error', (err) => {
            resolve({ online: false, error: err.message });
        });
    });
};

// Check ClamAV status
const checkClamAV = async () => {
    const host = process.env.CLAMAV_HOST || 'onlitec_clamav';
    const port = parseInt(process.env.CLAMAV_PORT) || 3310;

    try {
        // First check if port is open
        const pingResult = await tcpPing(host, port);

        if (!pingResult.online) {
            return {
                name: 'ClamAV',
                status: 'offline',
                error: pingResult.error,
                host,
                port
            };
        }

        // Try to get version via IDSESSION command
        return {
            name: 'ClamAV',
            status: 'online',
            host,
            port,
            message: 'Service responding on port ' + port
        };
    } catch (error) {
        return {
            name: 'ClamAV',
            status: 'offline',
            error: error.message
        };
    }
};

// Check Rspamd status
const checkRspamd = async () => {
    const host = process.env.RSPAMD_HOST || 'onlitec_rspamd';
    const port = parseInt(process.env.RSPAMD_PORT) || 11334;

    try {
        const result = await httpGet(`http://${host}:${port}/ping`);

        if (result.online && result.data && result.data.includes('pong')) {
            return {
                name: 'Rspamd',
                status: 'online',
                host,
                port,
                message: 'Ping successful'
            };
        }

        return {
            name: 'Rspamd',
            status: 'offline',
            host,
            port,
            error: result.error || 'Invalid response'
        };
    } catch (error) {
        return {
            name: 'Rspamd',
            status: 'offline',
            error: error.message
        };
    }
};

// Check Postfix status
const checkPostfix = async () => {
    const host = process.env.POSTFIX_HOST || 'onlitec_postfix';

    try {
        // Check if SMTP port is open
        const pingResult = await tcpPing(host, 25);

        if (!pingResult.online) {
            return {
                name: 'Postfix',
                status: 'offline',
                error: pingResult.error,
                host,
                port: 25
            };
        }

        return {
            name: 'Postfix',
            status: 'online',
            host,
            ports: [25, 587, 465],
            message: 'SMTP service responding'
        };
    } catch (error) {
        return {
            name: 'Postfix',
            status: 'offline',
            error: error.message
        };
    }
};

// Check Redis status
const checkRedis = async () => {
    const host = process.env.REDIS_HOST || 'onlitec_redis';
    const port = parseInt(process.env.REDIS_PORT) || 6379;

    try {
        const pingResult = await tcpPing(host, port);

        if (!pingResult.online) {
            return {
                name: 'Redis',
                status: 'offline',
                error: pingResult.error,
                host,
                port
            };
        }

        return {
            name: 'Redis',
            status: 'online',
            host,
            port,
            message: 'Service responding'
        };
    } catch (error) {
        return {
            name: 'Redis',
            status: 'offline',
            error: error.message
        };
    }
};

// Check PostgreSQL status
const checkPostgreSQL = async () => {
    const host = process.env.POSTGRES_HOST || 'onlitec_emailprotect_db';
    const port = parseInt(process.env.POSTGRES_PORT) || 5432;

    try {
        const result = await pool.query('SELECT 1 as check');

        if (result.rows && result.rows[0] && result.rows[0].check === 1) {
            return {
                name: 'PostgreSQL',
                status: 'online',
                host,
                port,
                message: 'Database accepting connections'
            };
        }

        return {
            name: 'PostgreSQL',
            status: 'offline',
            error: 'Query failed'
        };
    } catch (error) {
        return {
            name: 'PostgreSQL',
            status: 'offline',
            error: error.message
        };
    }
};

// Get all services status
exports.getStatus = async (req, res) => {
    try {
        const [clamav, rspamd, postfix, redis, postgresql] = await Promise.all([
            checkClamAV(),
            checkRspamd(),
            checkPostfix(),
            checkRedis(),
            checkPostgreSQL()
        ]);

        const services = [clamav, rspamd, postfix, redis, postgresql];
        const allOnline = services.every(s => s.status === 'online');
        const someOffline = services.some(s => s.status === 'offline');

        res.json({
            success: true,
            data: {
                overall: allOnline ? 'healthy' : (someOffline ? 'degraded' : 'critical'),
                services,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error checking services status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATUS_ERROR',
                message: 'Failed to check services status'
            }
        });
    }
};

// Get detailed metrics
exports.getMetrics = async (req, res) => {
    try {
        const metrics = {};

        // PostgreSQL metrics
        try {
            const dbSize = await pool.query(`
                SELECT pg_database_size(current_database()) as size
            `);
            const connCount = await pool.query(`
                SELECT count(*) as count FROM pg_stat_activity
            `);
            metrics.postgresql = {
                databaseSize: parseInt(dbSize.rows[0]?.size) || 0,
                activeConnections: parseInt(connCount.rows[0]?.count) || 0
            };
        } catch (e) {
            metrics.postgresql = { error: e.message };
        }

        // Mail stats from database
        try {
            const mailStats = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'delivered' OR status = 'accepted' THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN is_spam = true THEN 1 ELSE 0 END) as spam
                FROM mail_logs
                WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
            `);
            metrics.mail = {
                totalToday: parseInt(mailStats.rows[0]?.total) || 0,
                deliveredToday: parseInt(mailStats.rows[0]?.delivered) || 0,
                rejectedToday: parseInt(mailStats.rows[0]?.rejected) || 0,
                spamToday: parseInt(mailStats.rows[0]?.spam) || 0
            };
        } catch (e) {
            metrics.mail = { error: e.message };
        }

        res.json({
            success: true,
            data: {
                metrics,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting service metrics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'METRICS_ERROR',
                message: 'Failed to get service metrics'
            }
        });
    }
};

// Get Postfix queue (if accessible)
exports.getQueue = async (req, res) => {
    try {
        // Since we can't directly access Postfix from the panel container,
        // we'll return a placeholder. In production, this could be done via
        // a shared volume or an API endpoint on the Postfix container.

        res.json({
            success: true,
            data: {
                queue: [],
                message: 'Queue information requires direct Postfix access',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting Postfix queue:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'QUEUE_ERROR',
                message: 'Failed to get Postfix queue'
            }
        });
    }
};
