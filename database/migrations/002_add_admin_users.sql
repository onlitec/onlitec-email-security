-- Migration: Create Admin Users Table
-- Onlitec Email Protection - Admin Panel
-- Date: 2024-12-24

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'viewer')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create index for email lookups
CREATE INDEX idx_admin_users_email ON admin_users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_admin_users_status ON admin_users(status);

-- Create trigger to update updated_at
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create default super admin user
-- Password: admin123 (CHANGE THIS IN PRODUCTION!)
-- Hash generated with bcrypt, rounds=10
INSERT INTO admin_users (email, password_hash, full_name, role, status)
VALUES (
    'admin@onlitec.com',
    '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.uUIr5pPWpR8.qr3x3r5b5YJa',
    'System Administrator',
    'superadmin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Create sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Comments
COMMENT ON TABLE admin_users IS 'Administrative users for the email protection panel';
COMMENT ON TABLE admin_sessions IS 'Active sessions for admin users';
COMMENT ON COLUMN admin_users.role IS 'User role: super-admin (full access), admin (manage tenants), viewer (read-only)';
