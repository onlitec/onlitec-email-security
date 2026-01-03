#!/bin/bash
# Onlitec Email Protection - Postfix Entrypoint Script

set -e

echo "========================================="
echo "Onlitec Email Protection - Postfix"
echo "========================================="

# Environment variables
POSTGRES_HOST="${POSTGRES_HOST:-onlitec_emailprotect_db}"
POSTGRES_DB="${POSTGRES_DB:-emailprotect}"
POSTGRES_USER="${POSTGRES_USER:-emailprotect}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme123}"
MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.onlitec.local}"
RSPAMD_HOST="${RSPAMD_HOST:-onlitec_rspamd}"

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up!"

# Wait for Rspamd
# Wait for Rspamd (max 30 attempts)
echo "Waiting for Rspamd..."
count=0
until nc -z "$RSPAMD_HOST" 11333 2>/dev/null || [ $count -eq 30 ]; do
  echo "Rspamd is unavailable - sleeping ($count/30)"
  sleep 2
  count=$((count+1))
done

if [ $count -eq 30 ]; then
    echo "⚠ Warning: Rspamd timed out - continuing anyway..."
else
    echo "Rspamd is up!"
fi

# Update PostgreSQL connection files with environment variables
if [ -n "$POSTGRES_PASSWORD" ]; then
    echo "Updating PostgreSQL connection configurations..."
    
    for cf_file in /etc/postfix/pgsql/*.cf; do
        if [ -f "$cf_file" ]; then
            sed -i "s/^hosts =.*/hosts = $POSTGRES_HOST/" "$cf_file"
            sed -i "s/^user =.*/user = $POSTGRES_USER/" "$cf_file"
            sed -i "s/^password =.*/password = $POSTGRES_PASSWORD/" "$cf_file"
            sed -i "s/^dbname =.*/dbname = $POSTGRES_DB/" "$cf_file"
        fi
    done
fi

# Update main.cf with environment variables
# Check if main.cf is a bind mount (read-only issue)
if [ -n "$MAIL_HOSTNAME" ]; then
    echo "Setting hostname to: $MAIL_HOSTNAME"
    # Try to update, if fails, use alternative config file
    if ! postconf -e "myhostname = $MAIL_HOSTNAME" 2>/dev/null; then
        echo "Warning: Could not modify main.cf directly (bind mount?)"
        echo "Creating override configuration..."
        mkdir -p /etc/postfix/main.cf.d
        echo "myhostname = $MAIL_HOSTNAME" > /etc/postfix/main.cf.d/00-hostname.cf
    fi
fi

# Update Rspamd connection
if [ -n "$RSPAMD_HOST" ]; then
    echo "Setting Rspamd host to: $RSPAMD_HOST"
    # Try to update, if fails, use alternative config file
    if ! postconf -e "smtpd_milters = inet:$RSPAMD_HOST:11332" 2>/dev/null; then
        echo "Warning: Could not modify main.cf directly (bind mount?)"
        echo "Creating override configuration..."
        mkdir -p /etc/postfix/main.cf.d
        {
            echo "smtpd_milters = inet:$RSPAMD_HOST:11332"
            echo "non_smtpd_milters = inet:$RSPAMD_HOST:11332"
        } > /etc/postfix/main.cf.d/01-rspamd.cf
    else
        postconf -e "non_smtpd_milters = inet:$RSPAMD_HOST:11332" 2>/dev/null || true
    fi
fi

# Generate self-signed certificate if not exists
if [ ! -f /etc/postfix/certs/cert.pem ]; then
    echo "Generating self-signed certificate..."
    mkdir -p /etc/postfix/certs
    openssl req -new -x509 -days 3650 -nodes \
        -out /etc/postfix/certs/cert.pem \
        -keyout /etc/postfix/certs/key.pem \
        -subj "/C=BR/ST=State/L=City/O=Onlitec/OU=IT/CN=$MAIL_HOSTNAME"
    
    # Generate DH parameters
    openssl dhparam -out /etc/postfix/certs/dh2048.pem 2048
    
    chmod 600 /etc/postfix/certs/key.pem
    chmod 644 /etc/postfix/certs/cert.pem
fi

# Create necessary directories
mkdir -p /var/spool/postfix
mkdir -p /var/mail
mkdir -p /var/log/mail

# Set permissions
chown -R postfix:postfix /var/spool/postfix
chmod 755 /var/spool/postfix

# Create aliases database if not exists
if [ ! -f /etc/aliases.db ]; then
    echo "Creating aliases database..."
    newaliases
fi

# Create header_checks files if they don't exist
touch /etc/postfix/header_checks
touch /etc/postfix/mime_header_checks
touch /etc/postfix/submission_header_checks

# Test Postfix configuration
echo "Testing Postfix configuration..."
if postfix check 2>&1; then
    echo "✓ Postfix configuration OK"
else
    echo "⚠ Postfix configuration check failed, but continuing..."
fi

# Update postfix maps
echo "Updating Postfix maps..."
postmap /etc/postfix/pgsql/virtual_domains.cf 2>&1 || echo "⚠ Could not update virtual_domains map"
postmap /etc/postfix/pgsql/virtual_mailboxes.cf 2>&1 || echo "⚠ Could not update virtual_mailboxes map"
postmap /etc/postfix/pgsql/virtual_aliases.cf 2>&1 || echo "⚠ Could not update virtual_aliases map"

# Create/update SASL password database for relay authentication
if [ -f /etc/postfix/sasl_passwd ]; then
    echo "Creating SASL password database..."
    # Copy to a writable location if original is read-only
    cp /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.tmp 2>/dev/null || true
    if [ -f /etc/postfix/sasl_passwd.tmp ]; then
        postmap hash:/etc/postfix/sasl_passwd.tmp
        mv /etc/postfix/sasl_passwd.tmp.db /etc/postfix/sasl_passwd.db 2>/dev/null || true
        rm -f /etc/postfix/sasl_passwd.tmp
    else
        postmap hash:/etc/postfix/sasl_passwd
    fi
    chmod 600 /etc/postfix/sasl_passwd.db 2>/dev/null || true
    echo "✓ SASL password database created"
else
    echo "⚠ No sasl_passwd file found - relay authentication may not work"
fi

# Start rsyslog
echo "Starting rsyslog..."
service rsyslog start || true

# Show configuration
echo "========================================="
echo "Configuration Summary:"
echo "========================================="
echo "Hostname: $(postconf -h myhostname)"
echo "Domain: $(postconf -h mydomain)"
echo "PostgreSQL: $POSTGRES_HOST:5432/$POSTGRES_DB"
echo "Rspamd: $RSPAMD_HOST:11332"
echo "Virtual domains: $(postconf -h virtual_mailbox_domains)"
echo "========================================="

# Start Postfix
if [ "$1" = "supervisord" ]; then
    echo "Starting Postfix via supervisor..."
    exec "$@"
else
    echo "Starting Postfix in foreground..."
    exec postfix start-fg
fi
