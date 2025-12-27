-- Onlitec Email Protection - Production Seed Data
-- This file creates only essential configuration for production
-- Test data has been removed as the platform is now in production

-- ============================================
-- PRODUCTION NOTES:
-- ============================================
-- 1. Tenants, domains, and users should be created through the admin panel
-- 2. Statistics (daily_stats) are populated automatically by the email system
-- 3. Mail logs and quarantine are populated automatically during email processing
-- 4. Spam policies can be configured per tenant through the panel

-- ============================================
-- ADMIN USER VERIFICATION
-- ============================================
-- The admin user for the panel should already exist in admin_users table
-- If not, you can create one with the following (replace values as needed):

-- INSERT INTO admin_users (email, password_hash, role)
-- VALUES (
--     'admin@yourdomain.com',
--     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- changeme123!
--     'super_admin'
-- ) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- NO TEST DATA IN PRODUCTION
-- ============================================
-- Previous test tenants ("Onlitec", "Example Corp") have been removed
-- Previous test domains (onlitec.local, example.com) have been removed
-- Previous random daily_stats have been removed
-- 
-- All data displayed in the dashboard now comes from real email processing

COMMIT;
