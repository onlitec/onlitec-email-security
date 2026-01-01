-- Migration: Fix Admin User Roles
-- This migration ensures all admin users have proper 'superadmin' role
-- to fix 403 permission errors

BEGIN;

-- Update all users with email containing 'onlitec' to superadmin
UPDATE admin_users 
SET role = 'superadmin', updated_at = NOW() 
WHERE (email LIKE '%@onlitec%' OR email LIKE '%admin%') 
  AND role != 'superadmin';

-- Also ensure any 'admin' role users are upgraded to superadmin
UPDATE admin_users 
SET role = 'superadmin', updated_at = NOW() 
WHERE role = 'admin';

-- Log the current state
DO $$
BEGIN
    RAISE NOTICE 'Admin users updated to superadmin role';
END $$;

COMMIT;
