-- Onlitec Email Protection - Multi-Tenant Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TENANT MANAGEMENT
-- ============================================

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    max_users INTEGER DEFAULT 100,
    max_domains INTEGER DEFAULT 10,
    storage_quota_mb INTEGER DEFAULT 10240,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Domains table (multi-domain per tenant)
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_verification')),
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    dkim_public_key TEXT,
    dkim_private_key TEXT,
    dkim_selector VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_domains_tenant_id ON domains(tenant_id);
CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_status ON domains(status);

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Virtual email addresses (aliases)
CREATE TABLE virtual_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    destination TEXT NOT NULL, -- Can be comma-separated list
    is_catch_all BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_virtual_addresses_tenant_id ON virtual_addresses(tenant_id);
CREATE INDEX idx_virtual_addresses_domain_id ON virtual_addresses(domain_id);
CREATE INDEX idx_virtual_addresses_email ON virtual_addresses(email);

-- ============================================
-- SPAM & ANTIVIRUS POLICIES
-- ============================================

-- Tenant spam policies
CREATE TABLE spam_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Rspamd scores
    greylisting_score NUMERIC(5,2) DEFAULT 4.0,
    add_header_score NUMERIC(5,2) DEFAULT 5.0,
    rewrite_subject_score NUMERIC(5,2) DEFAULT 10.0,
    reject_score NUMERIC(5,2) DEFAULT 15.0,
    
    -- Actions
    enable_greylisting BOOLEAN DEFAULT TRUE,
    enable_bayes BOOLEAN DEFAULT TRUE,
    enable_dkim_check BOOLEAN DEFAULT TRUE,
    enable_spf_check BOOLEAN DEFAULT TRUE,
    enable_dmarc_check BOOLEAN DEFAULT TRUE,
    
    -- Quarantine
    quarantine_spam BOOLEAN DEFAULT TRUE,
    quarantine_virus BOOLEAN DEFAULT TRUE,
    quarantine_retention_days INTEGER DEFAULT 30,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_spam_policies_tenant_id ON spam_policies(tenant_id);

-- Whitelist
CREATE TABLE whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'domain', 'ip')),
    value VARCHAR(255) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, type, value)
);

CREATE INDEX idx_whitelist_tenant_id ON whitelist(tenant_id);
CREATE INDEX idx_whitelist_type ON whitelist(type);

-- Blacklist
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'domain', 'ip')),
    value VARCHAR(255) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, type, value)
);

CREATE INDEX idx_blacklist_tenant_id ON blacklist(tenant_id);
CREATE INDEX idx_blacklist_type ON blacklist(type);

-- ============================================
-- QUARANTINE
-- ============================================

-- Quarantined emails
CREATE TABLE quarantine (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    
    -- Email info
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    subject TEXT,
    size_bytes INTEGER,
    
    -- Detection
    reason VARCHAR(50) CHECK (reason IN ('spam', 'virus', 'policy', 'blacklist')),
    spam_score NUMERIC(5,2),
    virus_name VARCHAR(255),
    
    -- Storage
    file_path TEXT,
    headers TEXT,
    body TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'released', 'deleted', 'reported')),
    released_by UUID REFERENCES users(id) ON DELETE SET NULL,
    released_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_quarantine_tenant_id ON quarantine(tenant_id);
CREATE INDEX idx_quarantine_status ON quarantine(status);
CREATE INDEX idx_quarantine_created_at ON quarantine(created_at);
CREATE INDEX idx_quarantine_expires_at ON quarantine(expires_at);

-- ============================================
-- LOGS & STATISTICS
-- ============================================

-- Mail logs
CREATE TABLE mail_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    
    -- Email info
    message_id VARCHAR(255),
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    subject TEXT,
    size_bytes INTEGER,
    
    -- Processing
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) CHECK (status IN ('accepted', 'rejected', 'deferred', 'bounced')),
    smtp_code INTEGER,
    dsn_message TEXT,
    
    -- Spam/Virus
    spam_score NUMERIC(5,2),
    is_spam BOOLEAN DEFAULT FALSE,
    is_virus BOOLEAN DEFAULT FALSE,
    virus_name VARCHAR(255),
    
    -- Performance
    processing_time_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mail_logs_tenant_id ON mail_logs(tenant_id);
CREATE INDEX idx_mail_logs_created_at ON mail_logs(created_at);
CREATE INDEX idx_mail_logs_status ON mail_logs(status);
CREATE INDEX idx_mail_logs_direction ON mail_logs(direction);

-- Daily statistics per tenant
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Email counts
    total_received INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_spam INTEGER DEFAULT 0,
    total_virus INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    total_quarantined INTEGER DEFAULT 0,
    
    -- Sizes
    total_size_bytes BIGINT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_daily_stats_tenant_id ON daily_stats(tenant_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);

-- ============================================
-- API & AUTHENTICATION
-- ============================================

-- API tokens
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    permissions TEXT[], -- Array of permissions
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL
);

CREATE INDEX idx_api_tokens_tenant_id ON api_tokens(tenant_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spam_policies_updated_at BEFORE UPDATE ON spam_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON daily_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired quarantine
CREATE OR REPLACE FUNCTION clean_expired_quarantine()
RETURNS void AS $$
BEGIN
    DELETE FROM quarantine WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant by domain
CREATE OR REPLACE FUNCTION get_tenant_by_domain(domain_name VARCHAR)
RETURNS UUID AS $$
DECLARE
    tenant_uuid UUID;
BEGIN
    SELECT tenant_id INTO tenant_uuid
    FROM domains
    WHERE domain = domain_name AND status = 'active' AND deleted_at IS NULL;
    
    RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR POSTFIX QUERIES
-- ============================================

-- View for virtual domains
CREATE OR REPLACE VIEW postfix_virtual_domains AS
SELECT 
    d.domain,
    t.id as tenant_id,
    t.name as tenant_name
FROM domains d
JOIN tenants t ON d.tenant_id = t.id
WHERE d.status = 'active' 
  AND t.status = 'active'
  AND d.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- View for virtual mailboxes
CREATE OR REPLACE VIEW postfix_virtual_mailboxes AS
SELECT 
    va.email,
    va.destination,
    t.id as tenant_id
FROM virtual_addresses va
JOIN domains d ON va.domain_id = d.id
JOIN tenants t ON va.tenant_id = t.id
WHERE va.enabled = TRUE
  AND d.status = 'active'
  AND t.status = 'active'
  AND d.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- View for virtual aliases
CREATE OR REPLACE VIEW postfix_virtual_aliases AS
SELECT 
    va.email as source,
    va.destination,
    t.id as tenant_id
FROM virtual_addresses va
JOIN domains d ON va.domain_id = d.id
JOIN tenants t ON va.tenant_id = t.id
WHERE va.enabled = TRUE
  AND va.user_id IS NULL -- Only aliases, not actual mailboxes
  AND d.status = 'active'
  AND t.status = 'active'
  AND d.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- ============================================
-- INITIAL DATA
-- ============================================

COMMENT ON DATABASE emailprotect IS 'Onlitec Email Protection - Multi-Tenant Database';

-- Create indexes for better performance
CREATE INDEX idx_mail_logs_from_address ON mail_logs(from_address);
CREATE INDEX idx_mail_logs_to_address ON mail_logs(to_address);
CREATE INDEX idx_quarantine_from_address ON quarantine(from_address);
CREATE INDEX idx_quarantine_to_address ON quarantine(to_address);
