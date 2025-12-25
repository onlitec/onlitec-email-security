-- Migration: Add Relay Configuration to Domains Table
-- Onlitec Email Protection
-- Date: 2024-12-24

-- Add relay configuration columns to domains table
ALTER TABLE domains
ADD COLUMN relay_host VARCHAR(255),
ADD COLUMN relay_port INTEGER DEFAULT 25, 
ADD COLUMN relay_use_tls BOOLEAN DEFAULT TRUE,
ADD COLUMN relay_username VARCHAR(255),
ADD COLUMN relay_password VARCHAR(255);

-- Create index for relay lookups
CREATE INDEX idx_domains_relay_host ON domains(relay_host) WHERE relay_host IS NOT NULL;

-- Create table for SASL passwords (if using authenticated relay)
CREATE TABLE IF NOT EXISTS postfix_sasl_passwords (
    domain VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create view for transport maps
CREATE OR REPLACE VIEW postfix_transport_maps AS
SELECT 
    d.domain,
    CASE 
        WHEN d.relay_host IS NOT NULL THEN 
            'smtp:[' || d.relay_host || ']:' || COALESCE(d.relay_port::text, '25')
        ELSE 
            'virtual'
    END AS transport,
    d.relay_host,
    d.relay_port,
    d.relay_use_tls,
    t.id as tenant_id
FROM domains d
JOIN tenants t ON d.tenant_id = t.id
WHERE d.status = 'active'
  AND t.status = 'active'
  AND d.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- Create view for SASL passwords
CREATE OR REPLACE VIEW postfix_sasl_password_view AS
SELECT 
    d.domain,
    d.relay_username || ':' || d.relay_password AS credentials
FROM domains d
WHERE d.relay_username IS NOT NULL 
  AND d.relay_password IS NOT NULL
  AND d.status = 'active'
  AND d.deleted_at IS NULL;

-- Function to sync SASL passwords
CREATE OR REPLACE FUNCTION sync_sasl_passwords()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.relay_username IS NOT NULL AND NEW.relay_password IS NOT NULL THEN
        INSERT INTO postfix_sasl_passwords (domain, username, password)
        VALUES (NEW.domain, NEW.relay_username, NEW.relay_password)
        ON CONFLICT (domain) 
        DO UPDATE SET 
            username = EXCLUDED.username,
            password = EXCLUDED.password,
            updated_at = CURRENT_TIMESTAMP;
    ELSE
        DELETE FROM postfix_sasl_passwords WHERE domain = NEW.domain;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync SASL passwords
DROP TRIGGER IF EXISTS sync_sasl_passwords_trigger ON domains;
CREATE TRIGGER sync_sasl_passwords_trigger
AFTER INSERT OR UPDATE ON domains
FOR EACH ROW
EXECUTE FUNCTION sync_sasl_passwords();

-- Add comments
COMMENT ON COLUMN domains.relay_host IS 'Destination SMTP server hostname for relay (e.g., mail.client.com)';
COMMENT ON COLUMN domains.relay_port IS 'Destination SMTP server port (default: 25)';
COMMENT ON COLUMN domains.relay_use_tls IS 'Whether to use TLS/STARTTLS when relaying';
COMMENT ON COLUMN domains.relay_username IS 'SMTP AUTH username for relay (if required)';
COMMENT ON COLUMN domains.relay_password IS 'SMTP AUTH password for relay (if required)';
COMMENT ON TABLE postfix_sasl_passwords IS 'SASL credentials for authenticated relay';
COMMENT ON VIEW postfix_transport_maps IS 'Transport maps for Postfix routing';
