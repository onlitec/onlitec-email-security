-- Onlitec Email Protection - Seed Data (Example Tenant)
-- This creates example data for testing the multi-tenant system

-- ============================================
-- TENANT 1: Onlitec (Primary)
-- ============================================

-- Create tenant
INSERT INTO tenants (id, name, slug, status, max_users, max_domains, storage_quota_mb)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Onlitec',
    'onlitec',
    'active',
    500,
    20,
    51200
) ON CONFLICT DO NOTHING;

-- Create domain
INSERT INTO domains (id, tenant_id, domain, status, verified, dkim_selector)
VALUES (
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'onlitec.local',
    'active',
    TRUE,
    'default'
) ON CONFLICT DO NOTHING;

-- Create admin user
-- Password: changeme123! (bcrypt hash)
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status)
VALUES (
    '00000000-0000-0001-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@onlitec.local',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- changeme123!
    'System Administrator',
    'admin',
    'active'
) ON CONFLICT DO NOTHING;

-- Create test user
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status)
VALUES (
    '00000000-0000-0001-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'test@onlitec.local',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- changeme123!
    'Test User',
    'user',
    'active'
) ON CONFLICT DO NOTHING;

-- Create virtual addresses (mailboxes)
INSERT INTO virtual_addresses (tenant_id, domain_id, user_id, email, destination, is_catch_all, enabled)
VALUES 
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0001-000000000001',
        '00000000-0000-0001-0000-000000000001',
        'admin@onlitec.local',
        'admin@onlitec.local',
        FALSE,
        TRUE
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0001-000000000001',
        '00000000-0000-0001-0000-000000000002',
        'test@onlitec.local',
        'test@onlitec.local',
        FALSE,
        TRUE
    )
ON CONFLICT DO NOTHING;

-- Create spam policy
INSERT INTO spam_policies (
    tenant_id,
    name,
    is_default,
    greylisting_score,
    add_header_score,
    rewrite_subject_score,
    reject_score,
    enable_greylisting,
    enable_bayes,
    enable_dkim_check,
    enable_spf_check,
    enable_dmarc_check,
    quarantine_spam,
    quarantine_virus,
    quarantine_retention_days
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Policy',
    TRUE,
    4.0,
    5.0,
    10.0,
    15.0,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    30
) ON CONFLICT DO NOTHING;

-- ============================================
-- TENANT 2: Example Corp
-- ============================================

-- Create tenant
INSERT INTO tenants (id, name, slug, status, max_users, max_domains, storage_quota_mb)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Example Corp',
    'example-corp',
    'active',
    100,
    5,
    10240
) ON CONFLICT DO NOTHING;

-- Create domain
INSERT INTO domains (id, tenant_id, domain, status, verified, dkim_selector)
VALUES (
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'example.com',
    'active',
    TRUE,
    'default'
) ON CONFLICT DO NOTHING;

-- Create admin user for Example Corp
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, status)
VALUES (
    '00000000-0000-0001-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'admin@example.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- changeme123!
    'Example Admin',
    'admin',
    'active'
) ON CONFLICT DO NOTHING;

-- Create virtual address
INSERT INTO virtual_addresses (tenant_id, domain_id, user_id, email, destination, is_catch_all, enabled)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0001-0000-000000000003',
    'admin@example.com',
    'admin@example.com',
    FALSE,
    TRUE
) ON CONFLICT DO NOTHING;

-- Create spam policy with stricter settings
INSERT INTO spam_policies (
    tenant_id,
    name,
    is_default,
    greylisting_score,
    add_header_score,
    rewrite_subject_score,
    reject_score,
    enable_greylisting,
    enable_bayes,
    enable_dkim_check,
    enable_spf_check,
    enable_dmarc_check,
    quarantine_spam,
    quarantine_virus,
    quarantine_retention_days
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Strict Policy',
    TRUE,
    3.0,
    4.0,
    6.0,
    10.0,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    15
) ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE WHITELIST/BLACKLIST
-- ============================================

-- Whitelist example (Onlitec tenant)
INSERT INTO whitelist (tenant_id, type, value, comment)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'domain', 'trusted-partner.com', 'Trusted business partner'),
    ('00000000-0000-0000-0000-000000000001', 'email', 'newsletter@legitimate-sender.com', 'Newsletter subscription'),
    ('00000000-0000-0000-0000-000000000001', 'ip', '192.168.1.100', 'Internal mail server')
ON CONFLICT DO NOTHING;

-- Blacklist example (Onlitec tenant)
INSERT INTO blacklist (tenant_id, type, value, comment)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'domain', 'spam-domain.xyz', 'Known spam source'),
    ('00000000-0000-0000-0000-000000000001', 'email', 'spammer@badactor.com', 'Repeated spam attempts')
ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE STATISTICS (Last 7 days)
-- ============================================

-- Generate daily stats for the last 7 days
DO $$
DECLARE
    i INTEGER;
    stat_date DATE;
BEGIN
    FOR i IN 0..6 LOOP
        stat_date := CURRENT_DATE - i;
        
        -- Onlitec stats
        INSERT INTO daily_stats (
            tenant_id, date,
            total_received, total_sent, total_spam, total_virus,
            total_rejected, total_quarantined, total_size_bytes
        )
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            stat_date,
            FLOOR(RANDOM() * 1000 + 500)::INTEGER,
            FLOOR(RANDOM() * 500 + 200)::INTEGER,
            FLOOR(RANDOM() * 100 + 20)::INTEGER,
            FLOOR(RANDOM() * 5)::INTEGER,
            FLOOR(RANDOM() * 50 + 10)::INTEGER,
            FLOOR(RANDOM() * 30 + 5)::INTEGER,
            FLOOR(RANDOM() * 10000000 + 5000000)::BIGINT
        ) ON CONFLICT DO NOTHING;
        
        -- Example Corp stats
        INSERT INTO daily_stats (
            tenant_id, date,
            total_received, total_sent, total_spam, total_virus,
            total_rejected, total_quarantined, total_size_bytes
        )
        VALUES (
            '00000000-0000-0000-0000-000000000002',
            stat_date,
            FLOOR(RANDOM() * 300 + 100)::INTEGER,
            FLOOR(RANDOM() * 150 + 50)::INTEGER,
            FLOOR(RANDOM() * 30 + 5)::INTEGER,
            FLOOR(RANDOM() * 2)::INTEGER,
            FLOOR(RANDOM() * 15 + 2)::INTEGER,
            FLOOR(RANDOM() * 10 + 1)::INTEGER,
            FLOOR(RANDOM() * 3000000 + 1000000)::BIGINT
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Display created tenants
SELECT 
    t.name,
    t.slug,
    t.status,
    COUNT(DISTINCT d.id) as domains_count,
    COUNT(DISTINCT u.id) as users_count
FROM tenants t
LEFT JOIN domains d ON t.id = d.tenant_id
LEFT JOIN users u ON t.id = u.tenant_id
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.slug, t.status;

-- Display created domains
SELECT 
    d.domain,
    t.name as tenant_name,
    d.status,
    d.verified,
    COUNT(va.id) as addresses_count
FROM domains d
JOIN tenants t ON d.tenant_id = t.id
LEFT JOIN virtual_addresses va ON d.id = va.domain_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.domain, t.name, d.status, d.verified;

-- Display users
SELECT 
    u.email,
    u.full_name,
    u.role,
    t.name as tenant_name,
    u.status
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.deleted_at IS NULL
ORDER BY t.name, u.role, u.email;

COMMIT;
