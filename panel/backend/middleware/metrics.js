// Metrics middleware (simplified version without Prometheus for now)
const startTime = Date.now();
const requestCounts = { total: 0, success: 0, error: 0 };

const setupMetrics = () => {
    // Setup can be expanded later with Prometheus client
    console.log('Metrics setup complete');
};

const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    requestCounts.total++;

    res.on('finish', () => {
        const duration = Date.now() - start;
        if (res.statusCode < 400) {
            requestCounts.success++;
        } else {
            requestCounts.error++;
        }
    });

    next();
};

const register = {
    contentType: 'text/plain',
    metrics: async () => {
        const uptime = (Date.now() - startTime) / 1000;
        return `
# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total ${requestCounts.total}

# HELP requests_success Successful requests
# TYPE requests_success counter
requests_success ${requestCounts.success}

# HELP requests_error Failed requests
# TYPE requests_error counter
requests_error ${requestCounts.error}

# HELP uptime_seconds Server uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds ${uptime}
`;
    }
};

module.exports = { setupMetrics, metricsMiddleware, register };
