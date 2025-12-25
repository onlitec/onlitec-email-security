const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(`Error: ${err.message}`, {
        stack: err.stack,
        url: req.url,
        method: req.method
    });

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        },
        timestamp: new Date().toISOString()
    });
};

module.exports = { errorHandler };
