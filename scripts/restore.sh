#!/bin/bash
# Restore backup do Onlitec Email Protection

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_prefix>"
    echo ""
    echo "Example: $0 onlitec_email_backup_20241224_120000"
    echo ""
    echo "Available backups:"
    ls -1 /backups/onlitec-email/onlitec_email_backup_*_metadata.json 2>/dev/null | \
        sed 's/_metadata.json//' | xargs -n1 basename | sort -r | head -10
    exit 1
fi

BACKUP_PREFIX=$1
BACKUP_DIR="${BACKUP_DIR:-/backups/onlitec-email}"

echo -e "${YELLOW}========================================="
echo "Onlitec Email Protection - Restore"
echo -e "=========================================${NC}"
echo "Backup: $BACKUP_PREFIX"
echo ""

# Verify backup files exist
if [ ! -f "${BACKUP_DIR}/${BACKUP_PREFIX}_database.sql.gz" ]; then
    echo -e "${RED}Error: Backup files not found in $BACKUP_DIR${NC}"
    exit 1
fi

# Show backup info
if [ -f "${BACKUP_DIR}/${BACKUP_PREFIX}_metadata.json" ]; then
    echo "Backup metadata:"
    cat "${BACKUP_DIR}/${BACKUP_PREFIX}_metadata.json"
    echo ""
fi

read -p "Are you sure you want to restore this backup? This will OVERWRITE current data! (yes/no) " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# 1. Stop services (except database)
echo -e "${YELLOW}[1/5] Stopping services...${NC}"
docker-compose stop onlitec_postfix onlitec_rspamd onlitec_clamav onlitec_emailprotect_panel
echo -e "${GREEN}✓ Services stopped${NC}"

# 2. Restore PostgreSQL
echo -e "${YELLOW}[2/5] Restoring PostgreSQL database...${NC}"
echo "Dropping existing database..."
docker exec onlitec_emailprotect_db psql -U emailprotect -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring from backup..."
gunzip < "${BACKUP_DIR}/${BACKUP_PREFIX}_database.sql.gz" | \
    docker exec -i onlitec_emailprotect_db psql -U emailprotect

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    exit 1
fi

# 3. Restore Redis
echo -e "${YELLOW}[3/5] Restoring Redis data...${NC}"
if [ -f "${BACKUP_DIR}/${BACKUP_PREFIX}_redis.rdb" ]; then
    docker-compose stop onlitec_redis
    docker cp "${BACKUP_DIR}/${BACKUP_PREFIX}_redis.rdb" onlitec_redis:/data/dump.rdb
    docker-compose start onlitec_redis
    echo -e "${GREEN}✓ Redis restored${NC}"
else
    echo "No Redis backup found, skipping"
fi

# 4. Restore configurations
echo -e "${YELLOW}[4/5] Restoring configurations...${NC}"
if [ -f "${BACKUP_DIR}/${BACKUP_PREFIX}_configs.tar.gz" ]; then
    cd /home/alfreire/docker/apps/onlitec-email
    
    # Backup current configs first
    tar -czf "/tmp/current_configs_$(date +%Y%m%d_%H%M%S).tar.gz" .env postfix/ rspamd/ clamav/ redis/ 2>/dev/null || true
    
    # Restore
    tar -xzf "${BACKUP_DIR}/${BACKUP_PREFIX}_configs.tar.gz"
    echo -e "${GREEN}✓ Configurations restored${NC}"
else
    echo "No config backup found, skipping"
fi

# 5. Restore uploads
echo -e "${YELLOW}[5/5] Restoring uploads...${NC}"
if [ -f "${BACKUP_DIR}/${BACKUP_PREFIX}_uploads.tar.gz" ]; then
    cd /home/alfreire/docker/apps/onlitec-email
    tar -xzf "${BACKUP_DIR}/${BACKUP_PREFIX}_uploads.tar.gz"
    echo -e "${GREEN}✓ Uploads restored${NC}"
else
    echo "No uploads backup found, skipping"
fi

# Restart all services
echo -e "${YELLOW}Restarting all services...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}========================================="
echo "Restore Completed Successfully!"
echo -e "=========================================${NC}"
echo ""
echo "Services are starting up..."
echo "Monitor with: docker-compose logs -f"
echo ""
echo "Verify with: ./scripts/test_connectivity.sh"
