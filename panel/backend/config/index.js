/**
 * Onlitec Email Protection - Centralized Configuration
 * All values MUST come from environment variables
 * NO hardcoded fallbacks for critical settings in production
 */

const requiredEnvVars = [
    'POSTGRES_PASSWORD',
    'JWT_SECRET',
    'SESSION_SECRET'
];

// Validate required environment variables
function validateEnv() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('Please check your .env file or environment configuration.');
        process.exit(1);
    }
}

// Only validate in production
if (process.env.NODE_ENV === 'production') {
    validateEnv();
}

const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',

    // Application
    app: {
        port: parseInt(process.env.PORT || '9080', 10),
        url: process.env.APP_URL || `http://localhost:${process.env.PORT || 9080}`,
    },

    // API
    api: {
        url: process.env.API_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 9080}`,
    },

    // Database (PostgreSQL)
    database: {
        host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
        port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10),
        name: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
        user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123',
        get connectionString() {
            return `postgres://${this.user}:${this.password}@${this.host}:${this.port}/${this.name}`;
        }
    },

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'onlitec_redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || null,
        get url() {
            const auth = this.password ? `:${this.password}@` : '';
            return `redis://${auth}${this.host}:${this.port}`;
        }
    },

    // Authentication & Security
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
    },

    // Admin (initial setup)
    admin: {
        email: process.env.ADMIN_EMAIL || 'admin@onlitec.local',
        password: process.env.ADMIN_PASSWORD || 'changeme123!',
    },

    // CORS
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        origins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
    },

    // Rspamd
    rspamd: {
        host: process.env.RSPAMD_HOST || 'onlitec_rspamd',
        port: parseInt(process.env.RSPAMD_PORT || '11334', 10),
        password: process.env.RSPAMD_PASSWORD || '',
    },

    // Postfix
    postfix: {
        host: process.env.POSTFIX_HOST || 'onlitec_postfix',
    },

    // Mail
    mail: {
        hostname: process.env.MAIL_HOSTNAME || 'mail.onlitec.local',
        domain: process.env.MAIL_DOMAIN || 'onlitec.local',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};

module.exports = config;
