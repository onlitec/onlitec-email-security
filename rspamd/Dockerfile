FROM debian:bookworm-slim

# Install Rspamd
RUN apt-get update && apt-get install -y \
    rspamd \
    redis-tools \
    postgresql-client \
    lua5.1 \
    lua-socket \
    lua-lpeg \
    curl \
    netcat-openbsd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /var/lib/rspamd \
    /var/log/rspamd \
    /etc/rspamd/local.d \
    /etc/rspamd/override.d \
    /etc/rspamd/scripts

# Copy configuration files
COPY local.d/ /etc/rspamd/local.d/
COPY override.d/ /etc/rspamd/override.d/
COPY scripts/ /etc/rspamd/scripts/

# Copy entrypoint
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
# 11332 - Milter
# 11333 - Normal worker
# 11334 - Controller (Web UI)
EXPOSE 11332 11333 11334

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:11334/ping || exit 1

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/rspamd", "-f", "-u", "_rspamd", "-g", "_rspamd"]
