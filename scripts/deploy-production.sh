#!/bin/bash
# Script de Deploy para Produção - Onlitec Email Security
# Execute este script no servidor de produção

set -e

echo "=========================================="
echo "  Onlitec Email Security - Deploy Script"
echo "=========================================="

# 1. Pull latest code
echo ""
echo "[1/5] Baixando código mais recente do GitHub..."
git pull origin main

# 2. Rebuild panel container
echo ""
echo "[2/5] Reconstruindo container do painel..."
docker-compose build --no-cache onlitec_emailprotect_panel

# 3. Recreate container
echo ""
echo "[3/5] Recriando container..."
docker-compose rm -sf onlitec_emailprotect_panel
docker-compose up -d onlitec_emailprotect_panel

# 4. Apply database migrations
echo ""
echo "[4/5] Aplicando migrações do banco de dados..."
sleep 5  # Wait for container to start

# Check if migration file exists and apply
if [ -f "database/migrations/007_fix_domains_schema.sql" ]; then
    cat database/migrations/007_fix_domains_schema.sql | docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect
    echo "    - Migração 007_fix_domains_schema.sql aplicada"
fi

if [ -f "database/migrations/008_fix_admin_roles.sql" ]; then
    cat database/migrations/008_fix_admin_roles.sql | docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect
    echo "    - Migração 008_fix_admin_roles.sql aplicada"
fi

if [ -f "database/migrations/009_fix_transport_maps.sql" ]; then
    cat database/migrations/009_fix_transport_maps.sql | docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect
    echo "    - Migração 009_fix_transport_maps.sql aplicada (Correção de entrega de email)"
fi

if [ -f "database/migrations/010_allow_deleted_status.sql" ]; then
    cat database/migrations/010_allow_deleted_status.sql | docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect
    echo "    - Migração 010_allow_deleted_status.sql aplicada (Correção de Soft Delete)"
fi

# Rebuild and restart Postfix to apply volume changes (SASL auth fix)
echo ""
echo "[EXTRA] Atualizando configuração do Postfix (Relay Auth Fix)..."
docker-compose build onlitec_postfix
docker-compose rm -sf onlitec_postfix
docker-compose up -d onlitec_postfix

# Rebuild and restart Rspamd to apply timeout fix
echo ""
echo "[EXTRA] Atualizando configuração do Rspamd (Timeout Fix)..."
docker-compose build onlitec_rspamd
docker-compose rm -sf onlitec_rspamd
docker-compose up -d onlitec_rspamd

# Rebuild and restart ClamAV to apply Bytecode Fix (Memory/Crash fix)
echo ""
echo "[EXTRA] Atualizando configuração do ClamAV (Bug Fix)..."
docker-compose build onlitec_clamav
docker-compose rm -sf onlitec_clamav
docker-compose up -d onlitec_clamav

# 5. Fix user permissions - Set admin users to superadmin
echo ""
echo "[5/5] Atualizando permissões de usuários admin..."
docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c "UPDATE admin_users SET role = 'superadmin' WHERE role = 'admin' OR email LIKE '%@onlitec%'"

# Verify
echo ""
echo "=========================================="
echo "  Deploy Concluído!"
echo "=========================================="
echo ""
echo "Usuários atualizados:"
docker-compose exec -T onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c "SELECT email, role, status FROM admin_users"

echo ""
echo "Versão atual:"
curl -s http://localhost:9080/api/config | grep -o '"version":"[^"]*"'

echo ""
echo "IMPORTANTE: Faça logout e login novamente no painel para obter um novo token com as permissões atualizadas."
