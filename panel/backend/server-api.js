const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'emailprotect',
    user: process.env.DB_USER || 'emailprotect',
    password: process.env.DB_PASSWORD || 'changeme123',
    max: 20,
});

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected:', res.rows[0].now);
    }
});

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM tenants');
        res.json({
            status: 'ok',
            database: 'connected',
            tenants: result.rows[0].count
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ==========================================
// TENANTS API
// ==========================================

// GET all tenants
app.get('/api/tenants', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.status,
        t.created_at,
        COUNT(DISTINCT d.id) as domains_count,
        COUNT(DISTINCT u.id) as users_count
      FROM tenants t
      LEFT JOIN domains d ON d.tenant_id = t.id AND d.deleted_at IS NULL
      LEFT JOIN users u ON u.tenant_id = t.id AND u.deleted_at IS NULL
      WHERE t.deleted_at IS NULL
      GROUP BY t.id, t.name, t.slug, t.status, t.created_at
      ORDER BY t.created_at DESC
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create tenant
app.post('/api/tenants', async (req, res) => {
    const { name, slug, domain, admin_email } = req.body;

    if (!name || !slug || !domain || !admin_email) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create tenant
        const tenantResult = await client.query(
            `INSERT INTO tenants (name, slug, status) 
       VALUES ($1, $2, 'active') 
       RETURNING id`,
            [name, slug]
        );
        const tenantId = tenantResult.rows[0].id;

        // Create domain
        await client.query(
            `INSERT INTO domains (tenant_id, domain, status, verified) 
       VALUES ($1, $2, 'active', false)`,
            [tenantId, domain]
        );

        // Create admin user
        const password = Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(password, 10);

        await client.query(
            `INSERT INTO users (tenant_id, email, password_hash, full_name, role, status) 
       VALUES ($1, $2, $3, $4, 'admin', 'active')`,
            [tenantId, admin_email, passwordHash, 'Administrator']
        );

        // Create default spam policy
        await client.query(
            `INSERT INTO spam_policies (tenant_id, name, reject_score, quarantine_score, add_header_score, greylist_score) 
       VALUES ($1, 'Default Policy', 15.0, 8.0, 6.0, 4.0)`,
            [tenantId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Tenant created successfully',
            data: {
                tenant_id: tenantId,
                admin_password: password
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating tenant:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

// ==========================================
// DOMAINS API
// ==========================================

// GET all domains
app.get('/api/domains', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        d.id,
        d.domain,
        d.status,
        d.verified,
        d.created_at,
        t.name as tenant_name,
        t.slug as tenant_slug
      FROM domains d
      JOIN tenants t ON d.tenant_id = t.id
      WHERE d.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching domains:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST add domain
app.post('/api/domains', async (req, res) => {
    const { tenant_id, domain } = req.body;

    if (!tenant_id || !domain) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields'
        });
    }

    try {
        await pool.query(
            `INSERT INTO domains (tenant_id, domain, status, verified) 
       VALUES ($1, $2, 'active', false)`,
            [tenant_id, domain]
        );

        res.json({
            success: true,
            message: 'Domain added successfully'
        });
    } catch (error) {
        console.error('Error adding domain:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// USERS API
// ==========================================

// GET all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.status,
        u.created_at,
        t.name as tenant_name
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// STATS API
// ==========================================

// GET statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = {};

        // Total tenants
        const tenants = await pool.query(
            'SELECT COUNT(*) as count FROM tenants WHERE status = $1 AND deleted_at IS NULL',
            ['active']
        );
        stats.tenants = parseInt(tenants.rows[0].count);

        // Total domains
        const domains = await pool.query(
            'SELECT COUNT(*) as count FROM domains WHERE status = $1 AND deleted_at IS NULL',
            ['active']
        );
        stats.domains = parseInt(domains.rows[0].count);

        // Total emails today
        const emailsToday = await pool.query(
            `SELECT COUNT(*) as count FROM mail_logs 
       WHERE created_at >= CURRENT_DATE`
        );
        stats.emails_today = parseInt(emailsToday.rows[0].count);

        // Spam blocked today
        const spamToday = await pool.query(
            `SELECT COUNT(*) as count FROM mail_logs 
       WHERE created_at >= CURRENT_DATE 
       AND action IN ('reject', 'quarantine')`
        );
        stats.spam_blocked = parseInt(spamToday.rows[0].count);

        // Emails in quarantine
        const quarantine = await pool.query(
            `SELECT COUNT(*) as count FROM quarantine 
       WHERE status = 'quarantined'`
        );
        stats.quarantine = parseInt(quarantine.rows[0].count);

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// QUARANTINE API
// ==========================================

// GET quarantine
app.get('/api/quarantine', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        q.id,
        q.from_address,
        q.to_address,
        q.subject,
        q.reason,
        q.score,
        q.status,
        q.created_at,
        t.name as tenant_name
      FROM quarantine q
      JOIN tenants t ON q.tenant_id = t.id
      WHERE q.status = 'quarantined'
      ORDER BY q.created_at DESC
      LIMIT 100
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching quarantine:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// SERVE FRONTEND
// ==========================================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('🛡️  Onlitec Email Protection Panel');
    console.log('====================================');
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_HOST || 'onlitec_emailprotect_db'}`);
    console.log('====================================');
});

module.exports = app;
