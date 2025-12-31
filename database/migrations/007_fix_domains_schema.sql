-- Add relay_use_tls column to domains table
BEGIN;

ALTER TABLE domains ADD COLUMN IF NOT EXISTS relay_use_tls BOOLEAN DEFAULT true;

COMMIT;
