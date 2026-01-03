#!/bin/bash
# Onlitec Email Protection - Rspamd Entrypoint Script

set -e

echo "========================================="
echo "Onlitec Email Protection - Rspamd"
echo "========================================="

# Environment variables
REDIS_HOST="${REDIS_HOST:-onlitec_redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
CLAMAV_HOST="${CLAMAV_HOST:-onlitec_clamav}"
CLAMAV_PORT="${CLAMAV_PORT:-3310}"
POSTGRES_HOST="${POSTGRES_HOST:-onlitec_emailprotect_db}"

# Wait for Redis
echo "Waiting for Redis..."
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; do
  echo "Redis is unavailable - sleeping"
  sleep 2
done
echo "Redis is up!"

# Wait for ClamAV
# Wait for ClamAV (max 60 attempts = 120s)
echo "Waiting for ClamAV..."
count=0
until nc -z "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || [ $count -eq 60 ]; do
  echo "ClamAV is unavailable - sleeping ($count/60)"
  sleep 2
  count=$((count+1))
done

if [ $count -eq 60 ]; then
    echo "⚠ Warning: ClamAV timed out - starting Rspamd without Antivirus confirmation..."
else
    echo "ClamAV is up!"
fi

# Wait for PostgreSQL  
echo "Waiting for PostgreSQL..."
until nc -z "$POSTGRES_HOST" 5432 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up!"

# Update Redis configuration
if [ -n "$REDIS_HOST" ]; then
    echo "Updating Redis configuration..."
    sed -i "s/servers = .*/servers = \"$REDIS_HOST:$REDIS_PORT\";/" /etc/rspamd/local.d/redis.conf
    sed -i "s/servers = .*/servers = \"$REDIS_HOST:$REDIS_PORT\";/" /etc/rspamd/local.d/classifier-bayes.conf
fi

# Update ClamAV configuration
if [ -n "$CLAMAV_HOST" ]; then
    echo "Updating ClamAV configuration..."
    sed -i "s/servers = .*/servers = \"$CLAMAV_HOST:$CLAMAV_PORT\";/" /etc/rspamd/local.d/antivirus.conf
fi

# Set proper permissions
chown -R _rspamd:_rspamd /var/lib/rspamd
chown -R _rspamd:_rspamd /var/log/rspamd

# Create log file
touch /var/log/rspamd/rspamd.log
chown _rspamd:_rspamd /var/log/rspamd/rspamd.log

# Test configuration
echo "Testing Rspamd configuration..."
/usr/bin/rspamadm configtest || {
    echo "Configuration test failed!"
    exit 1
}

echo "Configuration test passed!"

# Show configuration summary
echo "========================================="
echo "Configuration Summary:"
echo "========================================="
echo "Redis: $REDIS_HOST:$REDIS_PORT"
echo "ClamAV: $CLAMAV_HOST:$CLAMAV_PORT"
echo "PostgreSQL: $POSTGRES_HOST:5432"
echo "========================================="

# Load multi-tenant module
if [ -f /etc/rspamd/scripts/tenant_rules.lua ]; then
    echo "Loading multi-tenant rules..."
    # The module will be loaded automatically by Rspamd
fi

echo "Starting Rspamd..."
exec "$@"
