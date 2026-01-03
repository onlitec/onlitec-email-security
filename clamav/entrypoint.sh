#!/bin/bash
set -e

echo "Starting Onlitec ClamAV..."

# Ensure directories exist and permissions
mkdir -p /var/run/clamav /var/log/clamav /var/lib/clamav
chown -R clamav:clamav /var/run/clamav /var/log/clamav /var/lib/clamav

# Start freshclam in background to keep DB updated
echo "Starting freshclam daemon..."
freshclam -d --foreground=false &

# Start clamd in foreground
echo "Starting clamd..."
exec clamd -c /etc/clamav/clamd.conf
