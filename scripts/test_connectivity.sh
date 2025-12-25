#!/bin/bash
# Test connectivity between all Email Protection services

set -e

echo "=============================================="
echo "Onlitec Email Protection - Connectivity Test"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test connection
test_connection() {
    local name=$1
    local host=$2
    local port=$3
    
    echo -n "Testing $name ($host:$port)... "
    
    if nc -z -w5 "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test PostgreSQL
test_postgres() {
    local host=$1
    local user=$2
    local db=$3
    
    echo -n "Testing PostgreSQL ($host:5432)... "
    
    if docker exec onlitec_emailprotect_db pg_isready -h localhost -U "$user" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((TESTS_PASSED++))
        
        # Test database access
        echo -n "Testing database access ($db)... "
        if docker exec onlitec_emailprotect_db psql -U "$user" -d "$db" -c '\q' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ OK${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ FAILED${NC}"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to test Redis
test_redis() {
    local host=$1
    local port=$2
    
    echo -n "Testing Redis ($host:$port)... "
    
    if docker exec onlitec_redis redis-cli ping | grep -q PONG 2>/dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to test HTTP endpoint
test_http() {
    local name=$1
    local url=$2
    
    echo -n "Testing $name HTTP ($url)... "
    
    if curl -sf "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

echo "=== Container Status ==="
docker ps --filter "name=onlitec_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== Network Connectivity ==="

# PostgreSQL
test_postgres "onlitec_emailprotect_db" "emailprotect" "emailprotect"

# Redis
test_redis "onlitec_redis" "6379"

# ClamAV
test_connection "ClamAV" "localhost" "3310"

# Rspamd
test_connection "Rspamd Normal Worker" "localhost" "11333"
test_connection "Rspamd Controller" "localhost" "11334"
test_http "Rspamd Web UI" "http://localhost:11334/ping"

# Postfix
test_connection "Postfix SMTP" "localhost" "25"
test_connection "Postfix Submission" "localhost" "587"
test_connection "Postfix SMTPS" "localhost" "465"

# Panel
test_connection "Web Panel" "localhost" "9080"

echo ""
echo "=== Integration Tests ==="

# Test Postfix → Rspamd
echo -n "Testing Postfix → Rspamd integration... "
if docker exec onlitec_postfix postconf smtpd_milters | grep -q "onlitec_rspamd" 2>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test Rspamd → ClamAV
echo -n "Testing Rspamd → ClamAV integration... "
if docker exec onlitec_rspamd nc -z onlitec_clamav 3310 2>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test Rspamd → Redis
echo -n "Testing Rspamd → Redis integration... "
if docker exec onlitec_rspamd redis-cli -h onlitec_redis ping | grep -q PONG 2>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "=== Database Tests ==="

# Test tenants table
echo -n "Testing tenants table... "
TENANT_COUNT=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null | tr -d ' ')
if [ "$TENANT_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✓ OK${NC} ($TENANT_COUNT tenants)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test domains table
echo -n "Testing domains table... "
DOMAIN_COUNT=$(docker exec onlitec_emailprotect_db psql -U emailprotect -d emailprotect -t -c "SELECT COUNT(*) FROM domains;" 2>/dev/null | tr -d ' ')
if [ "$DOMAIN_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✓ OK${NC} ($DOMAIN_COUNT domains)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "=============================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "=============================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the logs.${NC}"
    exit 1
fi
