-- Fix DELETE operation (soft delete) failing due to constraint check
-- Add 'deleted' to allowed status values

BEGIN;

-- Update constraints for tenants
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check 
    CHECK (status IN ('active', 'suspended', 'inactive', 'deleted'));

-- Update constraints for domains
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_status_check;
ALTER TABLE domains ADD CONSTRAINT domains_status_check 
    CHECK (status IN ('active', 'inactive', 'pending_verification', 'deleted'));

COMMIT;
