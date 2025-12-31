-- Migration: Add Behavioral Analysis and Context Tracking Tables
-- Description: Adds support for historical domain tracking and sender-recipient relationship context

-- Enable UUID extension if not exists (already in schema but good practice for migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DOMAIN REPUTATION HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS domain_reputation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Volume Stats
    total_emails_sent INTEGER DEFAULT 0,
    total_spam_sent INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    
    -- Content Stats
    total_attachments_sent INTEGER DEFAULT 0,
    has_sent_pdf BOOLEAN DEFAULT FALSE,
    has_sent_zip BOOLEAN DEFAULT FALSE,
    has_sent_links BOOLEAN DEFAULT FALSE,
    
    -- Behavioral Patterns
    -- JSONB to store hour buckets e.g. {"09": 10, "10": 5}
    sending_hours_stats JSONB DEFAULT '{}'::jsonb,
    -- JSONB to store list of recent IPs / subnets (limit distinct count in logic)
    origin_ips_stats JSONB DEFAULT '[]'::jsonb,
    
    -- Risk Calculation
    calculated_trust_score NUMERIC(5,2) DEFAULT 0.0, -- 0.0 to 10.0 (10 = highly trusted)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(domain)
);

CREATE INDEX idx_domain_rep_domain ON domain_reputation_history(domain);
CREATE INDEX idx_domain_rep_last_seen ON domain_reputation_history(last_seen_at);

-- Trigger for updating timestamp
CREATE TRIGGER update_domain_rep_updated_at BEFORE UPDATE ON domain_reputation_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SENDER RECIPIENT CONTEXT
-- ============================================
-- Tracks "Has User A received email from Sender B before?"
-- This helps validade if a billing email is expected contextually.

CREATE TABLE IF NOT EXISTS sender_recipient_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- The internal recipient
    recipient_email VARCHAR(255) NOT NULL,
    
    -- The external sender
    sender_email VARCHAR(255) NOT NULL,
    sender_domain VARCHAR(255) NOT NULL,
    
    -- Relationship stats
    first_contact_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contact_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interaction_count INTEGER DEFAULT 1,
    
    -- Trust flags
    has_replied BOOLEAN DEFAULT FALSE, -- If we can track outbound replies
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(recipient_email, sender_email)
);

CREATE INDEX idx_context_recipient_sender ON sender_recipient_context(recipient_email, sender_email);
CREATE INDEX idx_context_sender_domain ON sender_recipient_context(sender_domain);

-- Trigger for updating timestamp
CREATE TRIGGER update_sender_context_updated_at BEFORE UPDATE ON sender_recipient_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

