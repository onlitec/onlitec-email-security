const { Pool } = require('pg');
const { getRedisClient } = require('../config/redis');
const config = require('../config');

async function syncDomains() {
    console.log('Starting domain sync to Redis...');

    const pool = new Pool(config.database);
    const redis = await getRedisClient();

    try {
        const result = await pool.query('SELECT domain, tenant_id FROM domains WHERE deleted_at IS NULL');

        console.log(`Found ${result.rows.length} domains in database.`);

        for (const row of result.rows) {
            const key = `domain:${row.domain}:tenant_id`;
            await redis.set(key, row.tenant_id);
            console.log(`Synced: ${row.domain} -> ${row.tenant_id}`);
        }

        console.log('Domain sync completed successfully.');
    } catch (err) {
        console.error('Error syncing domains:', err);
    } finally {
        await pool.end();
        await redis.quit(); // Use quit() instead of disconnect for node-redis v4
    }
}

syncDomains();
