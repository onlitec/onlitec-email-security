#!/bin/bash
# Email Test Script - Onlitec Email Protection
# Tests email relay functionality

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SMTP_HOST="localhost"
SMTP_PORT="25"
POSTFIX_CONTAINER="onlitec_postfix"

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

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Display banner
echo ""
echo "=========================================="
echo " 📧 Email Test - Onlitec Email Protection"
echo "=========================================="
echo ""

# Check if required tools are installed
command -v nc >/dev/null 2>&1 || { print_error "nc (netcat) is required but not installed."; exit 1; }

# Test 1: Check if Postfix is running
print_test "Testing Postfix status..."
if docker ps | grep -q $POSTFIX_CONTAINER; then
    print_info "✓ Postfix container is running"
else
    print_error "✗ Postfix container is not running"
    exit 1
fi

# Test 2: Check SMTP connectivity
print_test "Testing SMTP connectivity (port $SMTP_PORT)..."
if timeout 3 bash -c "</dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
    print_info "✓ SMTP port $SMTP_PORT is open"
else
    print_error "✗ Cannot connect to SMTP port $SMTP_PORT"
    exit 1
fi

# Test 3: Test SMTP banner
print_test "Testing SMTP banner..."
BANNER=$(echo "QUIT" | nc -w 3 $SMTP_HOST $SMTP_PORT 2>/dev/null | head -1)
if [[ $BANNER == *"220"* ]]; then
    print_info "✓ SMTP banner received: $BANNER"
else
    print_warn "⚠ Unexpected SMTP banner: $BANNER"
fi

# Test 4: Send test email
if [ -n "$1" ] && [ -n "$2" ]; then
    FROM_EMAIL=$1
    TO_EMAIL=$2
    
    print_test "Sending test email..."
    print_info "From: $FROM_EMAIL"
    print_info "To: $TO_EMAIL"
    
    # Create email
    EMAIL_BODY="Subject: Test Email from Onlitec Email Protection
From: $FROM_EMAIL
To: $TO_EMAIL
Date: $(date -R)

This is a test email from Onlitec Email Protection Platform.

Test ID: $(date +%s)
Timestamp: $(date)

If you received this email, the email relay is working correctly!

---
Onlitec Email Protection
https://onlitec.com
"

    # Send via SMTP
    {
        echo "EHLO $(hostname)"
        sleep 0.5
        echo "MAIL FROM:<$FROM_EMAIL>"
        sleep 0.5
        echo "RCPT TO:<$TO_EMAIL>"
        sleep 0.5
        echo "DATA"
        sleep 0.5
        echo "$EMAIL_BODY"
        echo "."
        sleep 0.5
        echo "QUIT"
    } | nc $SMTP_HOST $SMTP_PORT > /tmp/smtp_test.log 2>&1

    if grep -q "250" /tmp/smtp_test.log; then
        print_info "✓ Email sent successfully!"
        echo ""
        echo "SMTP Response:"
        cat /tmp/smtp_test.log | grep "250"
    else
        print_error "✗ Failed to send email"
        echo ""
        echo "SMTP Error:"
        cat /tmp/smtp_test.log
        exit 1
    fi
else
    print_warn "Skipping email send test (no recipient provided)"
    echo ""
    echo "To send a test email, run:"
    echo "  $0 from@example.com to@example.com"
fi

# Test 5: Check mail log
print_test "Checking mail logs..."
if docker exec $POSTFIX_CONTAINER test -f /var/log/mail/mail.log; then
    print_info "Recent log entries:"
    docker exec $POSTFIX_CONTAINER tail -5 /var/log/mail/mail.log
else
    print_warn "⚠ Mail log file not found"
fi

# Display relay configuration test
echo ""
echo "=========================================="
echo " 🔧 Test Relay Configuration"
echo "=========================================="
echo ""

print_test "Testing transport maps lookup..."

# Test domain lookup
if [ -n "$3" ]; then
    TEST_DOMAIN=$3
    print_info "Testing domain: $TEST_DOMAIN"
    
    TRANSPORT=$(docker exec $POSTFIX_CONTAINER postmap -q "$TEST_DOMAIN" pgsql:/etc/postfix/pgsql/transport_maps.cf 2>&1)
    
    if [ -n "$TRANSPORT" ]; then
        print_info "✓ Transport found: $TRANSPORT"
    else
        print_warn "⚠ No transport configured for domain $TEST_DOMAIN"
        echo "   Domain will use default transport (virtual)"
    fi
else
    print_warn "Skipping transport test (no domain provided)"
    echo ""
    echo "To test a domain's relay configuration, run:"
    echo "  $0 from@example.com to@example.com example.com"
fi

echo ""
echo "=========================================="
echo " ✅ Tests Complete!"
echo "=========================================="
echo ""

if [ -n "$1" ] && [ -n "$2" ]; then
    echo "Next steps:"
    echo "1. Check recipient inbox for test email"
    echo "2. Monitor logs: docker exec $POSTFIX_CONTAINER tail -f /var/log/mail/mail.log"
    echo "3. Check queue: docker exec $POSTFIX_CONTAINER mailq"
else
    echo "Run with parameters to send test email:"
    echo "  $0 <from_email> <to_email> [domain]"
    echo ""
    echo "Example:"
    echo "  $0 test@onlitec.com user@client.com client.com"
fi

echo ""
