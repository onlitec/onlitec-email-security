-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default roles if they don't exist
INSERT INTO roles (name, permissions)
VALUES 
    ('admin', '{"all": true}'),
    ('user', '{"view_stats": true, "view_logs": true, "manage_whitelist": true, "manage_blacklist": true}')
ON CONFLICT (name) DO NOTHING;

-- Seed default settings
INSERT INTO system_settings (key, value)
VALUES 
    ('site_name', 'Onlitec Email Protection'),
    ('smtp_host', ''),
    ('smtp_port', '587'),
    ('smtp_user', ''),
    ('smtp_pass', ''),
    ('smtp_secure', 'false'),
    ('smtp_from', 'noreply@example.com')
ON CONFLICT (key) DO NOTHING;

-- Add role_id to admin_users if it doesn't exist (optional, for now we stick to string role or link it)
-- For now, we will just keep the 'role' string column in admin_users but semantically link it to roles.name 
-- or we could add a foreign key. Let's keep it simple and just rely on the 'role' string matching roles.name.
