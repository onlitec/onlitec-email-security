-- Migration: Update allowed roles in admin_users
-- Add 'manager' to the allowed roles CHECK constraint

BEGIN;

-- Drop old check constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Add new check constraint with 'manager' included
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
    CHECK (role IN ('superadmin', 'admin', 'manager', 'viewer'));

COMMIT;
