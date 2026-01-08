const { createClient } = require('redis');
const logger = require('./logger');
const config = require('./index');

let redisClient;

const getRedisClient = async () => {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    redisClient = createClient({
        url: config.redis.url
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('Redis connected'));

    await redisClient.connect();
    return redisClient;
};

module.exports = {
    getRedisClient
};
