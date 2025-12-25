#!/bin/bash
# Backup automatizado do sistema Onlitec Email Protection

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/onlitec-email}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="onlitec_email_backup_${TIMESTAMP}"

echo -e "${YELLOW}========================================="
echo "Onlitec Email Protection - Backup"
echo -e "=========================================${NC}"
echo "Backup directory: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# 1. Backup PostgreSQL
echo -e "${YELLOW}[1/5] Backing up PostgreSQL database...${NC}"
docker exec onlitec_emailprotect_db pg_dump -U emailprotect emailprotect | \
  gzip > "${BACKUP_NAME}_database.sql.gz"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database backed up${NC}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    exit 1
fi

# 2. Backup Redis (optional, mostly cache)
echo -e"${YELLOW}[2/5] Backing up Redis data...${NC}"
docker exec onlitec_redis redis-cli BGSAVE
sleep 2
docker cp onlitec_redis:/data/dump.rdb "${BACKUP_NAME}_redis.rdb" 2>/dev/null || echo "Redis backup skipped (no dump.rdb)"
echo -e "${GREEN}✓ Redis backed up${NC}"

# 3. Backup configurations
echo -e "${YELLOW}[3/5] Backing up configurations...${NC}"
cd /home/alfreire/docker/apps/onlitec-email

tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_configs.tar.gz" \
    --exclude='*.log' \
    --exclude='node_modules' \
    --exclude='.git' \
    .env \
    postfix/main.cf \
    postfix/master.cf \
    postfix/pgsql/*.cf \
    rspamd/local.d/*.conf \
    rspamd/local.d/*.inc \
    rspamd/scripts/*.lua \
    clamav/clamd.conf \
    redis/redis.conf \
    docker-compose.yml 2>/dev/null

echo -e "${GREEN}✓ Configurations backed up${NC}"

# 4. Backup panel uploads (if any)
echo -e "${YELLOW}[4/5] Backing up panel uploads...${NC}"
if [ -d "panel/uploads" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz" panel/uploads/
    echo -e "${GREEN}✓ Uploads backed up${NC}"
else
    echo "No uploads directory found, skipping"
fi

# 5. Create metadata
echo -e "${YELLOW}[5/5] Creating backup metadata...${NC}"
cat > "${BACKUP_DIR}/${BACKUP_NAME}_metadata.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "version": "1.0.0",
  "components": {
    "database": "PostgreSQL 15",
    "postfix": "$(docker exec onlitec_postfix postconf mail_version | cut -d= -f2)",
    "rspamd": "Rspamd",
    "clamav": "ClamAV",
    "redis": "Redis 7"
  },
  "stats": {
    "tenants": $(docker exec onlitec_emailprotect_db psql -U emailprotect -t -c "SELECT COUNT(*) FROM tenants;" | tr -d ' '),
    "domains": $(docker exec onlitec_emailprotect_db psql -U emailprotect -t -c "SELECT COUNT(*) FROM domains;" | tr -d ' '),
    "users": $(docker exec onlitec_emailprotect_db psql -U emailprotect -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
  },
  "files": [
    "${BACKUP_NAME}_database.sql.gz",
    "${BACKUP_NAME}_redis.rdb",
    "${BACKUP_NAME}_configs.tar.gz",
    "${BACKUP_NAME}_uploads.tar.gz",
    "${BACKUP_NAME}_metadata.json"
  ]
}
EOF

echo -e "${GREEN}✓ Metadata created${NC}"

# Calculate total size
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}"* | awk '{sum+=$1} END {print sum}')

echo ""
echo -e "${GREEN}========================================="
echo "Backup Completed Successfully!"
echo -e "=========================================${NC}"
echo "Location: $BACKUP_DIR"
echo "Prefix: $BACKUP_NAME"
echo "Total size: $(du -sh ${BACKUP_DIR}/${BACKUP_NAME}* | tail -1 | awk '{print $1}')"
echo ""

# Clean old backups
echo -e "${YELLOW}Cleaning old backups (older than $RETENTION_DAYS days)...${NC}"
find "$BACKUP_DIR" -name "onlitec_email_backup_*" -type f -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✓ Old backups cleaned${NC}"

# List recent backups
echo ""
echo "Recent backups:"
ls -lh "$BACKUP_DIR" | grep "onlitec_email_backup_" | tail -5

echo ""
echo -e "${GREEN}Backup script finished!${NC}"
