#!/bin/bash
# DKIM Key Generator - Onlitec Email Protection
# Generates DKIM keys for a domain and stores in database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="onlitec_emailprotect_db"
DB_NAME="emailprotect"
DB_USER="emailprotect"
DB_PASS="changeme123"
KEY_SIZE=2048
SELECTOR="default"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if domain is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <domain> [selector]"
    echo "Example: $0 acme.com default"
    exit 1
fi

DOMAIN=$1
SELECTOR=${2:-default}

print_info "Generating DKIM keys for domain: $DOMAIN"
print_info "Selector: $SELECTOR"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

print_info "Generating RSA key pair ($KEY_SIZE bits)..."

# Generate private key
openssl genrsa -out dkim_private.pem $KEY_SIZE 2>/dev/null

# Extract public key
openssl rsa -in dkim_private.pem -pubout -outform DER 2>/dev/null | base64 | tr -d '\n' > dkim_public.txt

# Read keys
PRIVATE_KEY=$(cat dkim_private.pem | tr -d '\n')
PUBLIC_KEY=$(cat dkim_public.txt)

print_info "Keys generated successfully!"

# Store in database
print_info "Storing keys in database..."

# Escape single quotes for SQL
PRIVATE_KEY_ESCAPED=$(echo "$PRIVATE_KEY" | sed "s/'/''/g")

# Update domain with DKIM keys
SQL_QUERY="
UPDATE domains 
SET 
    dkim_private_key = '$PRIVATE_KEY_ESCAPED',
    dkim_public_key = '$PUBLIC_KEY',
    dkim_selector = '$SELECTOR',
    updated_at = NOW()
WHERE domain = '$DOMAIN';
"

# Execute SQL
echo "$SQL_QUERY" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_info "Keys stored in database successfully!"
else
    print_error "Failed to store keys in database"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Generate DNS record
DNS_RECORD="${SELECTOR}._domainkey.${DOMAIN}.    3600    IN    TXT    \"v=DKIM1; k=rsa; p=${PUBLIC_KEY}\""

# Display results
echo ""
echo "=========================================="
echo " DKIM Configuration Complete!"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Selector: $SELECTOR"
echo ""
echo "----------------------------------------"
echo " DNS RECORD TO PUBLISH:"
echo "----------------------------------------"
echo ""
echo "Type: TXT"
echo "Name: ${SELECTOR}._domainkey"
echo "Value: v=DKIM1; k=rsa; p=${PUBLIC_KEY}"
echo "TTL: 3600"
echo ""
echo "OR as zone file format:"
echo ""
echo "$DNS_RECORD"
echo ""
echo "----------------------------------------"
echo " VERIFICATION:"
echo "----------------------------------------"
echo ""
echo "After publishing DNS record, verify with:"
echo ""
echo "  dig TXT ${SELECTOR}._domainkey.${DOMAIN} +short"
echo ""
echo "Or online tool:"
echo "  https://mxtoolbox.com/dkim.aspx"
echo ""
echo "=========================================="

# Save to file
OUTPUT_FILE="/tmp/dkim_${DOMAIN}_${SELECTOR}.txt"
cat > "$OUTPUT_FILE" <<EOF
DKIM Configuration for: $DOMAIN
Selector: $SELECTOR
Generated: $(date)

===========================================
DNS RECORD
===========================================

Type: TXT
Name: ${SELECTOR}._domainkey
Value: v=DKIM1; k=rsa; p=${PUBLIC_KEY}
TTL: 3600

Zone file format:
$DNS_RECORD

===========================================
VERIFICATION
===========================================

Command:
dig TXT ${SELECTOR}._domainkey.${DOMAIN} +short

Online:
https://mxtoolbox.com/dkim.aspx

===========================================
KEYS STORED IN DATABASE
===========================================

Table: domains
Domain: $DOMAIN
Fields updated:
  - dkim_private_key (encrypted)
  - dkim_public_key 
  - dkim_selector

EOF

print_info "Configuration saved to: $OUTPUT_FILE"

# Cleanup
cd -
rm -rf "$TEMP_DIR"

print_info "Done! DKIM keys generated and stored successfully."
