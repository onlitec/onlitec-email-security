// Database configuration
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
    host: process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'emailprotect',
    user: process.env.DB_USER || 'emailprotect',
    password: process.env.DB_PASSWORD || 'changeme123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    logger.info('Database pool connected');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
