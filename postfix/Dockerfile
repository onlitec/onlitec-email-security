FROM debian:bookworm-slim

# Install Postfix and dependencies
RUN apt-get update && apt-get install -y \
    postfix \
    postfix-pgsql \
    sasl2-bin \
    libsasl2-modules \
    libsasl2-modules-sql \
    ca-certificates \
    openssl \
    supervisor \
    rsyslog \
    netcat-openbsd \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories
RUN mkdir -p /var/spool/postfix \
    /var/mail \
    /var/log/mail \
    /etc/postfix/pgsql \
    /etc/postfix/certs

# Copy configuration files
COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY pgsql/ /etc/postfix/pgsql/

# Copy scripts
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Configure supervisor
COPY supervisor.conf /etc/supervisor/conf.d/postfix.conf

# Configure rsyslog
RUN echo "mail.* /var/log/mail/mail.log" >> /etc/rsyslog.conf

# Expose ports
EXPOSE 25 587 465

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD postfix status || exit 1

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
