#!/bin/bash
# Debug script para verificar o conteúdo do container em produção
# Execute no servidor de produção

echo "=== Debug do Container de Produção ==="
echo ""

echo "1. Verificando hash do JavaScript no container:"
docker exec onlitec_emailprotect_panel ls -la /app/backend/public/assets/
echo ""

echo "2. Verificando se AdminUsers existe no bundle (procurando por 'AdminUsers' ou 'adminUsers'):"
docker exec onlitec_emailprotect_panel grep -l "AdminUsers\|adminUsers" /app/backend/public/assets/*.js 2>/dev/null && echo "✓ Encontrado" || echo "✗ NÃO encontrado no bundle!"
echo ""

echo "3. Verificando conteúdo do index.html:"
docker exec onlitec_emailprotect_panel cat /app/backend/public/index.html
echo ""

echo "4. Verificando se o Profile.jsx compilado contém a verificação de role:"
docker exec onlitec_emailprotect_panel grep -o "superadmin" /app/backend/public/assets/*.js | head -5
echo ""

echo "5. Verificando ID da imagem do container:"
docker inspect onlitec_emailprotect_panel --format '{{.Image}}'
echo ""

echo "6. Verificando quando a imagem foi criada:"
docker inspect onlitec_emailprotect_panel --format '{{.Created}}'
echo ""

echo "7. Testando endpoint /api/profile:"
TOKEN=$(docker exec onlitec_emailprotect_panel curl -s http://localhost:9080/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@onlitec.local","password":"admin123"}' | grep -oP '"accessToken":"\K[^"]+')
if [ -n "$TOKEN" ]; then
    echo "Token obtido. Verificando profile..."
    docker exec onlitec_emailprotect_panel curl -s "http://localhost:9080/api/profile" -H "Authorization: Bearer $TOKEN"
else
    echo "Falha ao obter token"
fi
echo ""
