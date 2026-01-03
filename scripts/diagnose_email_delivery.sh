#!/bin/bash

# ============================================
# DIAGNÓSTICO DE ENTREGA DE EMAIL
# Onlitec Email Security
# ============================================

echo "================================================"
echo "  DIAGNÓSTICO DE ENTREGA DE EMAIL"
echo "  $(date)"
echo "================================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para status
status_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ ERRO${NC}"
    fi
}

# ============================================
# 1. VERIFICAR CONTAINERS
# ============================================
echo -e "${BLUE}1. Verificando containers...${NC}"
echo "--------------------------------------------"

for container in onlitec_postfix onlitec_rspamd onlitec_emailprotect_db; do
    status=$(docker inspect -f '{{.State.Status}}' $container 2>/dev/null)
    if [ "$status" == "running" ]; then
        echo -e "  $container: ${GREEN}$status${NC}"
    else
        echo -e "  $container: ${RED}${status:-não encontrado}${NC}"
    fi
done
echo ""

# ============================================
# 2. VERIFICAR CONFIGURAÇÃO DE DOMÍNIOS
# ============================================
echo -e "${BLUE}2. Configuração de Domínios no Banco:${NC}"
echo "--------------------------------------------"
docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c \
    "SELECT domain, relay_host, relay_port, relay_use_tls, status FROM domains ORDER BY domain;" 2>/dev/null || \
    echo -e "${RED}Erro ao conectar ao banco de dados${NC}"
echo ""

# ============================================
# 3. VERIFICAR VIEW DE TRANSPORT MAPS
# ============================================
echo -e "${BLUE}3. View postfix_transport_maps:${NC}"
echo "--------------------------------------------"
docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c \
    "SELECT * FROM postfix_transport_maps;" 2>/dev/null || \
    echo -e "${RED}VIEW NÃO EXISTE! Execute a migration 009_fix_transport_maps.sql${NC}"
echo ""

# ============================================
# 4. VERIFICAR VIEW DE VIRTUAL DOMAINS
# ============================================
echo -e "${BLUE}4. View postfix_virtual_domains:${NC}"
echo "--------------------------------------------"
docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c \
    "SELECT * FROM postfix_virtual_domains;" 2>/dev/null || \
    echo -e "${RED}VIEW NÃO EXISTE!${NC}"
echo ""

# ============================================
# 5. VERIFICAR ARQUIVO SASL_PASSWD
# ============================================
echo -e "${BLUE}5. Arquivo sasl_passwd do Postfix:${NC}"
echo "--------------------------------------------"
docker exec onlitec_postfix cat /etc/postfix/sasl_passwd 2>/dev/null || \
    echo -e "${YELLOW}Arquivo sasl_passwd não encontrado ou vazio${NC}"
echo ""

# ============================================
# 6. TESTAR CONEXÃO COM RELAY HOST
# ============================================
echo -e "${BLUE}6. Testando conexão com relay hosts:${NC}"
echo "--------------------------------------------"

# Obter lista de relay hosts únicos
relay_hosts=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c \
    "SELECT DISTINCT relay_host || ':' || relay_port FROM domains WHERE relay_host IS NOT NULL AND relay_host != '';" 2>/dev/null)

if [ -n "$relay_hosts" ]; then
    while IFS= read -r line; do
        host_port=$(echo "$line" | tr -d ' ')
        if [ -n "$host_port" ]; then
            host=$(echo "$host_port" | cut -d: -f1)
            port=$(echo "$host_port" | cut -d: -f2)
            echo -n "  Testando $host:$port... "
            nc -z -w 5 $host $port 2>/dev/null
            status_check $?
        fi
    done <<< "$relay_hosts"
else
    echo -e "${YELLOW}Nenhum relay host configurado${NC}"
fi
echo ""

# ============================================
# 7. ÚLTIMOS LOGS DO POSTFIX (ENTREGAS)
# ============================================
echo -e "${BLUE}7. Últimos logs de entrega do Postfix:${NC}"
echo "--------------------------------------------"
docker logs onlitec_postfix --tail 50 2>&1 | grep -E "(status=|relay=|dsn=|error|reject|deferred|bounced)" | tail -20
echo ""

# ============================================
# 8. VERIFICAR EMAILS EM FILA
# ============================================
echo -e "${BLUE}8. Fila de emails do Postfix:${NC}"
echo "--------------------------------------------"
docker exec onlitec_postfix postqueue -p 2>/dev/null | head -20 || \
    echo -e "${YELLOW}Não foi possível verificar a fila${NC}"
echo ""

# ============================================
# 9. VERIFICAR LOGS DE ERRO RECENTES
# ============================================
echo -e "${BLUE}9. Erros recentes:${NC}"
echo "--------------------------------------------"
docker logs onlitec_postfix --tail 100 2>&1 | grep -iE "(error|fatal|warning|failed|timeout)" | tail -10
echo ""

# ============================================
# 10. RESUMO DE DIAGNÓSTICO
# ============================================
echo -e "${BLUE}10. RESUMO DE DIAGNÓSTICO:${NC}"
echo "============================================"

# Verificar se transport_maps existe
transport_exists=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c \
    "SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'postfix_transport_maps';" 2>/dev/null | tr -d ' ')

if [ "$transport_exists" = "0" ] || [ -z "$transport_exists" ]; then
    echo -e "${RED}⚠ PROBLEMA: View postfix_transport_maps NÃO EXISTE!${NC}"
    echo "  Solução: Execute a migration 009_fix_transport_maps.sql"
else
    echo -e "${GREEN}✓ View postfix_transport_maps existe${NC}"
fi

# Verificar se há domínios sem relay configurado
no_relay=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c \
    "SELECT COUNT(*) FROM domains WHERE status='active' AND (relay_host IS NULL OR relay_host = '');" 2>/dev/null | tr -d ' ')

if [ "$no_relay" != "0" ] && [ -n "$no_relay" ]; then
    echo -e "${YELLOW}⚠ ATENÇÃO: $no_relay domínio(s) ativo(s) sem relay configurado${NC}"
fi

# Verificar se há emails na fila
queue_count=$(docker exec onlitec_postfix mailq 2>/dev/null | grep -c "^[A-F0-9]" || echo "0")
if [ "$queue_count" != "0" ]; then
    echo -e "${YELLOW}⚠ ATENÇÃO: $queue_count email(s) na fila${NC}"
else
    echo -e "${GREEN}✓ Fila de emails vazia${NC}"
fi

echo ""
echo "============================================"
echo "  Diagnóstico concluído"
echo "============================================"
