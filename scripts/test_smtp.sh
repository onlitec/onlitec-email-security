#!/bin/bash
# SMTP Test Script for Onlitec Email Protection

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Usage
if [ $# -lt 2 ]; then
    echo "Usage: $0 <from_domain> <to_email> [options]"
    echo ""
    echo "Options:"
    echo "  --attach-eicar    Attach EICAR test virus"
    echo "  --spam-test       Send spam test email"
    echo "  --subject <text>  Custom subject"
    echo ""
    echo "Examples:"
    echo "  $0 onlitec.local recipient@example.com"
    echo "  $0 onlitec.local recipient@example.com --attach-eicar"
    echo "  $0 onlitec.local recipient@example.com --spam-test"
    exit 1
fi

FROM_DOMAIN=$1
TO_EMAIL=$2
FROM_EMAIL="test@$FROM_DOMAIN"
SUBJECT="Test Email from Onlitec"
ATTACH_EICAR=false
SPAM_TEST=false

# Parse options
shift 2
while [ $# -gt 0 ]; do
    case $1 in
        --attach-eicar)
            ATTACH_EICAR=true
            SUBJECT="EICAR Virus Test"
            ;;
        --spam-test)
            SPAM_TEST=true
            SUBJECT="Spam Test Email"
            ;;
        --subject)
            SUBJECT="$2"
            shift
            ;;
    esac
    shift
done

echo -e "${BLUE}=============================================="
echo "SMTP Test"
echo -e "==============================================${NC}"
echo "From:    $FROM_EMAIL"
echo "To:      $TO_EMAIL"
echo "Subject: $SUBJECT"
echo "Options: EICAR=$ATTACH_EICAR, SPAM=$SPAM_TEST"
echo ""

# Create email body
create_email() {
    local boundary="----=_Part_0_$(date +%s)"
    
    cat <<EOF
From: $FROM_EMAIL
To: $TO_EMAIL
Subject: $SUBJECT
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="$boundary"

--$boundary
Content-Type: text/plain; charset="UTF-8"

EOF

    if [ "$SPAM_TEST" = true ]; then
        cat <<EOF
This is a spam test email.

XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X

VIAGRA CIALIS FREE MONEY CLICK HERE NOW!!!
Winner winner chicken dinner! You've won \$1,000,000!
Click here to claim your prize: http://spam.example.com

GET RICH QUICK!!!
LOSE WEIGHT FAST!!!
BUY NOW!!!

--$boundary--
EOF
    elif [ "$ATTACH_EICAR" = true ]; then
        cat <<EOF
This is a virus test email with EICAR attachment.

The attachment contains the EICAR test virus string.
This should be detected and quarantined by ClamAV.

--$boundary
Content-Type: text/plain; name="eicar.txt"
Content-Disposition: attachment; filename="eicar.txt"
Content-Transfer-Encoding: base64

WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=

--$boundary--
EOF
    else
        cat <<EOF
This is a test email from the Onlitec Email Protection system.

Time: $(date)
From Domain: $FROM_DOMAIN
To: $TO_EMAIL

This email should pass through all filters:
- Postfix SMTP
- Rspamd anti-spam
- ClamAV antivirus
- Multi-tenant policy checks

If you receive this email, the system is working correctly!

--$boundary--
EOF
    fi
}

# Send email via SMTP
echo -e "${YELLOW}Sending email via SMTP...${NC}"

EMAIL_CONTENT=$(create_email)

# Use swaks if available, otherwise nc
if command -v swaks &> /dev/null; then
    echo "$EMAIL_CONTENT" | swaks \
        --from "$FROM_EMAIL" \
        --to "$TO_EMAIL" \
        --server localhost \
        --port 25 \
        --data - \
        --suppress-data
    
    RESULT=$?
else
    # Fallback to nc
    (
        echo "EHLO $FROM_DOMAIN"
        sleep 1
        echo "MAIL FROM:<$FROM_EMAIL>"
        sleep 1
        echo "RCPT TO:<$TO_EMAIL>"
        sleep 1
        echo "DATA"
        sleep 1
        echo "$EMAIL_CONTENT"
        echo "."
        sleep 1
        echo "QUIT"
    ) | nc localhost 25
    
    RESULT=$?
fi

if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ Email sent successfully!${NC}"
    echo ""
    
    # Check logs
    echo -e "${YELLOW}Recent Postfix logs:${NC}"
    docker logs --tail 10 onlitec_postfix 2>&1 | grep "$TO_EMAIL" || echo "No logs found yet"
    echo ""
    
    echo -e "${YELLOW}Recent Rspamd logs:${NC}"
    docker logs --tail 10 onlitec_rspamd 2>&1 | grep -i "from.*$FROM_EMAIL" || echo "No logs found yet"
    echo ""
    
    if [ "$ATTACH_EICAR" = true ]; then
        echo -e "${YELLOW}Expected result:${NC} Email should be REJECTED or QUARANTINED (virus detected)"
        echo ""
        echo -e "${YELLOW}Check ClamAV logs:${NC}"
        docker logs --tail 20 onlitec_clamav 2>&1 | grep -i "eicar\|virus" || echo "No virus logs found yet"
    elif [ "$SPAM_TEST" = true ]; then
        echo -e "${YELLOW}Expected result:${NC} Email should be marked as SPAM or QUARANTINED"
    else
        echo -e "${YELLOW}Expected result:${NC} Email should be DELIVERED successfully"
    fi
    
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "  1. Check quarantine table:"
    echo "     docker exec onlitec_emailprotect_db psql -U emailprotect -c 'SELECT * FROM quarantine ORDER BY created_at DESC LIMIT 5;'"
    echo ""
    echo "  2. Check mail logs:"
    echo "     docker exec onlitec_emailprotect_db psql -U emailprotect -c 'SELECT * FROM mail_logs ORDER BY created_at DESC LIMIT 5;'"
    echo ""
else
    echo -e "${RED}✗ Failed to send email${NC}"
    exit 1
fi
