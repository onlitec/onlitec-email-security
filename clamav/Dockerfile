FROM clamav/clamav:latest

# Install additional tools
USER root
RUN apk add --no-cache \
    netcat-openbsd \
    bash

# Create directories
RUN mkdir -p /var/log/clamav && chown -R clamav:clamav /var/log/clamav

# Copy custom configuration
COPY clamd.conf /etc/clamav/clamd.conf

# Expose port
EXPOSE 3310

# Health check
HEALTHCHECK --interval=60s --timeout=10s --retries=3 --start-period=300s \
    CMD /usr/local/bin/clamdscan --ping 3 || exit 1

