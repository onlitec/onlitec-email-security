// Onlitec Email Protection - Admin Panel Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const tenantsRoutes = require('./routes/tenants');
const domainsRoutes = require('./routes/domains');
const usersRoutes = require('./routes/users');
const policiesRoutes = require('./routes/policies');
const quarantineRoutes = require('./routes/quarantine');
const logsRoutes = require('./routes/logs');
const statsRoutes = require('./routes/stats');
const whitelistRoutes = require('./routes/whitelist');
const blacklistRoutes = require('./routes/blacklist');
const profileRoutes = require('./routes/profile');
const aliasesRoutes = require('./routes/aliases');
const auditRoutes = require('./routes/audit');
const servicesRoutes = require('./routes/services');
const managerRoutes = require('./routes/manager');
const rolesRoutes = require('./routes/roles');
const configRoutes = require('./routes/config');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { setupMetrics, metricsMiddleware } = require('./middleware/metrics');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 9080;

// ============================================
// MIDDLEWARE
// ============================================

// Security - Environment-aware configuration
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
    contentSecurityPolicy: isProduction ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    } : false, // Disable CSP in development
    crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,
    crossOriginEmbedderPolicy: isProduction,
    originAgentCluster: isProduction,
    hsts: isProduction, // Only enable HSTS in production
}));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ============================================
// SESSION & REDIS
// ============================================

let redisClient;
(async () => {
    redisClient = createClient({
        socket: {
            host: process.env.REDIS_HOST || 'onlitec_redis',
            port: process.env.REDIS_PORT || 6379
        }
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('Redis connected'));

    await redisClient.connect();

    // Session configuration
    app.use(session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
})();

// ============================================
// METRICS
// ============================================

setupMetrics();
app.use(metricsMiddleware);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: redisClient?.isOpen ? 'connected' : 'disconnected'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/quarantine', quarantineRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/aliases', aliasesRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/config', configRoutes);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    const register = require('./middleware/metrics').register;
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// ============================================
// STATIC FILES (React app) - Must be AFTER API routes
// ============================================

// Serve static files (React build)
app.use(express.static(path.join(__dirname, 'public')));

// Serve React app for any other route (catch-all must be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use(errorHandler);

// ============================================
// SERVER START
// ============================================

const server = app.listen(PORT, () => {
    logger.info(`🚀 Onlitec Email Protection Panel running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        logger.info('HTTP server closed');
        if (redisClient) {
            await redisClient.quit();
            logger.info('Redis connection closed');
        }
        process.exit(0);
    });
});

module.exports = app;
