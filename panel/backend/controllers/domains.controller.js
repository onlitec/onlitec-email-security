const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// List all domains
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 20, tenant_id, status, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT d.id, d.domain, d.tenant_id, d.status, d.verified,
                   d.relay_host, d.relay_port, d.relay_use_tls,
                   d.dkim_selector, d.dkim_public_key,
                   d.created_at, t.name as tenant_name
            FROM domains d
            LEFT JOIN tenants t ON d.tenant_id = t.id
            WHERE d.deleted_at IS NULL
        `;
        const params = [];
        let paramIndex = 1;

        if (tenant_id) {
            query += ` AND d.tenant_id = $${paramIndex++}`;
            params.push(tenant_id);
        }

        if (status) {
            query += ` AND d.status = $${paramIndex++}`;
            params.push(status);
        }

        if (search) {
            query += ` AND d.domain ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await pool.query(countQuery, params);
        const total = countResult.rows && countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;


        query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });

    } catch (error) {
        logger.error('Error listing domains:', error);
        res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: 'Failed to list domains' } });
    }
};

// Get single domain
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT d.*, t.name as tenant_name,
                   (SELECT COUNT(*) FROM users WHERE domain_id = d.id AND deleted_at IS NULL) as user_count
            FROM domains d
            LEFT JOIN tenants t ON d.tenant_id = t.id
            WHERE d.id = $1 AND d.deleted_at IS NULL
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error getting domain:', error);
        res.status(500).json({ success: false, error: { code: 'GET_ERROR', message: 'Failed to get domain' } });
    }
};

// Create domain
exports.create = async (req, res) => {
    try {
        const {
            domain, tenant_id, status = 'pending',
            relay_host, relay_port = 25, relay_username, relay_password, relay_use_tls = true
        } = req.body;

        if (!domain || !tenant_id) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Domain and tenant_id are required' }
            });
        }

        // Check domain uniqueness
        const existing = await pool.query('SELECT id FROM domains WHERE domain = $1 AND deleted_at IS NULL', [domain]);
        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: { code: 'DUPLICATE_DOMAIN', message: 'Domain already exists' }
            });
        }

        // Check tenant exists and domain limit
        const tenant = await pool.query('SELECT max_domains FROM tenants WHERE id = $1', [tenant_id]);
        if (tenant.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
        }

        const domainCount = await pool.query('SELECT COUNT(*) FROM domains WHERE tenant_id = $1 AND deleted_at IS NULL', [tenant_id]);
        if (parseInt(domainCount.rows[0].count) >= tenant.rows[0].max_domains) {
            return res.status(403).json({
                success: false,
                error: { code: 'LIMIT_EXCEEDED', message: 'Tenant domain limit exceeded' }
            });
        }

        const result = await pool.query(`
            INSERT INTO domains (domain, tenant_id, status, relay_host, relay_port, relay_username, relay_password, relay_use_tls)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [domain, tenant_id, status, relay_host, relay_port, relay_username, relay_password, relay_use_tls]);

        logger.info(`Domain created: ${domain}`);
        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error creating domain:', error);
        res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create domain' } });
    }
};

// Update domain
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, relay_host, relay_port, relay_username, relay_password, relay_use_tls } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (status) { updates.push(`status = $${paramIndex++}`); params.push(status); }
        if (relay_host !== undefined) { updates.push(`relay_host = $${paramIndex++}`); params.push(relay_host || null); }
        if (relay_port !== undefined) { updates.push(`relay_port = $${paramIndex++}`); params.push(relay_port); }
        if (relay_username !== undefined) { updates.push(`relay_username = $${paramIndex++}`); params.push(relay_username || null); }
        if (relay_password !== undefined) { updates.push(`relay_password = $${paramIndex++}`); params.push(relay_password || null); }
        if (relay_use_tls !== undefined) { updates.push(`relay_use_tls = $${paramIndex++}`); params.push(relay_use_tls); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const result = await pool.query(`
            UPDATE domains SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } });
        }

        logger.info(`Domain updated: ${id}`);
        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        logger.error('Error updating domain:', error);
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update domain' } });
    }
};

// Delete domain
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE domains SET deleted_at = NOW(), status = 'deleted'
            WHERE id = $1 AND deleted_at IS NULL RETURNING id, domain
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } });
        }

        logger.info(`Domain deleted: ${result.rows[0].domain}`);
        res.json({ success: true, message: 'Domain deleted successfully' });

    } catch (error) {
        logger.error('Error deleting domain:', error);
        res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete domain' } });
    }
};

// Generate DKIM keys for domain
exports.generateDkim = async (req, res) => {
    try {
        const { id } = req.params;
        const { selector = 'default' } = req.body;
        const crypto = require('crypto');

        // Get domain
        const domainResult = await pool.query('SELECT domain FROM domains WHERE id = $1', [id]);
        if (domainResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } });
        }

        const domainName = domainResult.rows[0].domain;

        // Generate RSA 2048-bit key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // Extract just the key part for DNS (remove headers and newlines)
        const publicKeyDns = publicKey
            .replace('-----BEGIN PUBLIC KEY-----', '')
            .replace('-----END PUBLIC KEY-----', '')
            .replace(/\n/g, '');

        // Update domain with DKIM keys
        await pool.query(`
            UPDATE domains SET 
                dkim_selector = $1,
                dkim_public_key = $2,
                dkim_private_key = $3,
                updated_at = NOW()
            WHERE id = $4
        `, [selector, publicKey, privateKey, id]);

        // Return DNS record for client to publish
        const dnsRecord = {
            type: 'TXT',
            name: `${selector}._domainkey.${domainName}`,
            value: `v=DKIM1; k=rsa; p=${publicKeyDns}`,
            ttl: 3600
        };

        logger.info(`DKIM generated for domain: ${domainName}`);
        res.json({
            success: true,
            data: {
                selector,
                dnsRecord,
                publicKey: publicKeyDns
            }
        });

    } catch (error) {
        logger.error('Error generating DKIM:', error);
        res.status(500).json({ success: false, error: { code: 'DKIM_ERROR', message: 'Failed to generate DKIM keys' } });
    }
};

// Verify DNS records for domain
exports.verifyDns = async (req, res) => {
    try {
        const { id } = req.params;
        const dns = require('dns').promises;

        // Get domain
        const domainResult = await pool.query('SELECT domain, dkim_selector FROM domains WHERE id = $1', [id]);
        if (domainResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } });
        }

        const domainName = domainResult.rows[0].domain;
        const dkimSelector = domainResult.rows[0].dkim_selector || 'default';
        const verification = { mx: false, spf: false, dkim: false };
        const details = {};

        // Check MX records
        try {
            const mxRecords = await dns.resolveMx(domainName);
            verification.mx = mxRecords.some(mx =>
                mx.exchange.includes('onlitec') || mx.exchange.includes('mail.onlitec')
            );
            details.mx = mxRecords.map(r => `${r.priority} ${r.exchange}`);
        } catch (e) {
            details.mx = 'No MX records found';
        }

        // Check SPF record
        try {
            const txtRecords = await dns.resolveTxt(domainName);
            const spfRecord = txtRecords.flat().find(r => r.startsWith('v=spf1'));
            verification.spf = spfRecord && spfRecord.includes('onlitec');
            details.spf = spfRecord || 'No SPF record found';
        } catch (e) {
            details.spf = 'No TXT records found';
        }

        // Check DKIM record
        try {
            const dkimDomain = `${dkimSelector}._domainkey.${domainName}`;
            const dkimRecords = await dns.resolveTxt(dkimDomain);
            const dkimRecord = dkimRecords.flat().find(r => r.includes('v=DKIM1'));
            verification.dkim = !!dkimRecord;
            details.dkim = dkimRecord || 'No DKIM record found';
        } catch (e) {
            details.dkim = 'No DKIM record found';
        }

        // Update domain verification status
        await pool.query(`
            UPDATE domains SET verified = $1, updated_at = NOW() WHERE id = $2
        `, [verification.mx && verification.spf, id]);

        logger.info(`DNS verified for domain: ${domainName} - MX:${verification.mx} SPF:${verification.spf} DKIM:${verification.dkim}`);
        res.json({ success: true, data: { verification, details } });

    } catch (error) {
        logger.error('Error verifying DNS:', error);
        res.status(500).json({ success: false, error: { code: 'DNS_ERROR', message: 'Failed to verify DNS' } });
    }
};
