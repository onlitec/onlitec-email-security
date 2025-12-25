#!/bin/bash
# Script to create a new tenant in the multi-tenant email system

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage
if [ $# -lt 2 ]; then
    echo "Usage: $0 <domain> <tenant_name> [admin_email] [admin_password]"
    echo ""
    echo "Example: $0 example.com \"Example Corp\" admin@example.com mypassword123"
    exit 1
fi

DOMAIN=$1
TENANT_NAME=$2
ADMIN_EMAIL=${3:-admin@$DOMAIN}
ADMIN_PASSWORD=${4:-$(openssl rand -base64 12)}

# Generate slug from tenant name
SLUG=$(echo "$TENANT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')

echo -e "${BLUE}=============================================="
echo "Creating New Tenant"
echo -e "==============================================${NC}"
echo ""
echo "Domain:          $DOMAIN"
echo "Tenant Name:     $TENANT_NAME"
echo "Slug:            $SLUG"
echo "Admin Email:     $ADMIN_EMAIL"
echo "Admin Password:  $ADMIN_PASSWORD"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo -e "${YELLOW}Creating tenant in database...${NC}"

# Create SQL for new tenant
SQL="
BEGIN;

-- Create tenant
INSERT INTO tenants (name, slug, status, max_users, max_domains, storage_quota_mb)
VALUES ('$TENANT_NAME', '$SLUG', 'active', 100, 5, 10240)
RETURNING id;

-- Get tenant ID (in production, you'd capture this properly)
DO \$\$
DECLARE
    new_tenant_id UUID;
    new_domain_id UUID;
    new_user_id UUID;
BEGIN
    -- Get the tenant we just created
    SELECT id INTO new_tenant_id FROM tenants WHERE slug = '$SLUG';
    
    -- Create domain
    INSERT INTO domains (tenant_id, domain, status, verified, dkim_selector)
    VALUES (new_tenant_id, '$DOMAIN', 'active', TRUE, 'default')
    RETURNING id INTO new_domain_id;
    
    -- Create admin user
    INSERT INTO users (tenant_id, email, password_hash, full_name, role, status)
    VALUES (
        new_tenant_id,
        '$ADMIN_EMAIL',
        crypt('$ADMIN_PASSWORD', gen_salt('bf')),
        'Administrator',
        'admin',
        'active'
    )
    RETURNING id INTO new_user_id;
    
    -- Create virtual address
    INSERT INTO virtual_addresses (tenant_id, domain_id, user_id, email, destination, enabled)
    VALUES (new_tenant_id, new_domain_id, new_user_id, '$ADMIN_EMAIL', '$ADMIN_EMAIL', TRUE);
    
    -- Create default spam policy
    INSERT INTO spam_policies (
        tenant_id,
        name,
        is_default,
        greylisting_score,
        add_header_score,
        rewrite_subject_score,
        reject_score,
        enable_greylisting,
        enable_bayes,
        enable_dkim_check,
        enable_spf_check,
        enable_dmarc_check,
        quarantine_spam,
        quarantine_virus,
        quarantine_retention_days
    )
    VALUES (
        new_tenant_id,
        'Default Policy',
        TRUE,
        4.0,
        5.0,
        10.0,
        15.0,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        30
    );
    
    RAISE NOTICE 'Tenant ID: %', new_tenant_id;
    RAISE NOTICE 'Domain ID: %', new_domain_id;
    RAISE NOTICE 'User ID: %', new_user_id;
END \$\$;

COMMIT;

-- Display results
SELECT 
    t.name as tenant,
    t.slug,
    d.domain,
    u.email as admin_email,
    t.status
FROM tenants t
LEFT JOIN domains d ON t.id = d.tenant_id
LEFT JOIN users u ON t.id = u.tenant_id AND u.role = 'admin'
WHERE t.slug = '$SLUG';
"

# Execute SQL
docker exec -i onlitec_emailprotect_db psql -U emailprotect -d emailprotect <<< "$SQL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Tenant created successfully!${NC}"
    echo ""
    
    # Cache tenant in Redis
    echo -e "${YELLOW}Caching tenant in Redis...${NC}"
    
    # Get tenant ID
    TENANT_ID=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c "SELECT id FROM tenants WHERE slug = '$SLUG';" | tr -d ' ')
    
    # Cache domain → tenant mapping
    docker exec onlitec_redis redis-cli SET "tenant:domain:$DOMAIN" "$TENANT_ID" >/dev/null
    
    # Cache tenant policy (simplified)
    docker exec onlitec_redis redis-cli HSET "tenant:policy:$TENANT_ID" \
        "greylisting_score" "4.0" \
        "add_header_score" "5.0" \
        "rewrite_subject_score" "10.0" \
        "reject_score" "15.0" >/dev/null
    
    echo -e "${GREEN}✓ Cached in Redis${NC}"
    echo ""
    
    # Reload Postfix to pick up new domain
    echo -e "${YELLOW}Reloading Postfix...${NC}"
    docker exec onlitec_postfix postfix reload >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Postfix reloaded${NC}"
    echo ""
    
    echo -e "${BLUE}=============================================="
    echo "Tenant Created Successfully!"
    echo -e "==============================================${NC}"
    echo ""
    echo -e "${GREEN}Tenant Details:${NC}"
    echo "  Domain:    $DOMAIN"
    echo "  Name:      $TENANT_NAME"
    echo "  Slug:      $SLUG"
    echo ""
    echo -e "${GREEN}Admin Credentials:${NC}"
    echo "  Email:     $ADMIN_EMAIL"
    echo "  Password:  $ADMIN_PASSWORD"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC} Save these credentials securely!"
    echo ""
    echo -e "${GREEN}Next Steps:${NC}"
    echo "  1. Configure DNS MX record for $DOMAIN"
    echo "  2. Generate DKIM keys (optional)"
    echo "  3. Test email sending/receiving"
    echo "  4. Configure SPF, DMARC records"
    echo ""
else
    echo -e "${RED}✗ Failed to create tenant${NC}"
    exit 1
fi
