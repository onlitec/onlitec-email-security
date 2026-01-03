#!/bin/bash

# ============================================
# TESTE DE ENVIO DE EMAIL (SMTP)
# Simula envio através do Postfix local
# ============================================

echo "================================================"
echo "  TESTE DE ENVIO DE EMAIL"
echo "  $(date)"
echo "================================================"
echo ""

# Configurações
SMTP_SERVER=${SMTP_SERVER:-"localhost"}
SMTP_PORT=${SMTP_PORT:-"25"}

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar argumentos
if [ $# -lt 2 ]; then
    echo "Uso: $0 <remetente@dominio> <destinatario@dominio> [assunto]"
    echo ""
    echo "Exemplos:"
    echo "  $0 teste@onlitec.com.br alfreire@onlitec.com.br"
    echo "  $0 externo@gmail.com usuario@onlitec.com.br 'Teste de Spam'"
    echo ""
    echo "Variáveis de ambiente:"
    echo "  SMTP_SERVER - Servidor SMTP (padrão: localhost)"
    echo "  SMTP_PORT   - Porta SMTP (padrão: 25)"
    exit 1
fi

FROM=$1
TO=$2
SUBJECT=${3:-"Teste de envio via Onlitec Email Security"}
DATE=$(date -R)
MESSAGE_ID="<$(date +%s).$(od -x /dev/urandom | head -1 | awk '{print $2}')@test.local>"

echo -e "${BLUE}Configurações:${NC}"
echo "  Servidor: $SMTP_SERVER:$SMTP_PORT"
echo "  De: $FROM"
echo "  Para: $TO"
echo "  Assunto: $SUBJECT"
echo ""

# Verificar se swaks está instalado
if command -v swaks &> /dev/null; then
    echo -e "${BLUE}Usando swaks para envio...${NC}"
    echo ""
    
    swaks \
        --server $SMTP_SERVER \
        --port $SMTP_PORT \
        --from "$FROM" \
        --to "$TO" \
        --header "Subject: $SUBJECT" \
        --header "Date: $DATE" \
        --header "Message-ID: $MESSAGE_ID" \
        --body "Este é um email de teste enviado via Onlitec Email Security.

Timestamp: $(date)
Servidor: $SMTP_SERVER:$SMTP_PORT
De: $FROM
Para: $TO

Este email foi gerado automaticamente para testar o fluxo de entrega.
Se você recebeu este email, o sistema está funcionando corretamente.

--
Onlitec Email Security
https://emailprotect.onlitec.com.br"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Email enviado com sucesso!${NC}"
    else
        echo ""
        echo -e "${RED}✗ Falha no envio${NC}"
    fi

else
    # Fallback para sendmail via docker
    echo -e "${BLUE}Usando sendmail via container do Postfix...${NC}"
    echo ""
    
    # Criar email temporário
    EMAIL_TEMP=$(mktemp)
    cat > $EMAIL_TEMP << EOF
From: $FROM
To: $TO
Subject: $SUBJECT
Date: $DATE
Message-ID: $MESSAGE_ID
Content-Type: text/plain; charset=utf-8

Este é um email de teste enviado via Onlitec Email Security.

Timestamp: $(date)
Servidor: Postfix container
De: $FROM
Para: $TO

Este email foi gerado automaticamente para testar o fluxo de entrega.
Se você recebeu este email, o sistema está funcionando corretamente.

--
Onlitec Email Security
https://emailprotect.onlitec.com.br
EOF

    echo "Conteúdo do email:"
    echo "--------------------------------------------"
    cat $EMAIL_TEMP
    echo "--------------------------------------------"
    echo ""
    
    # Enviar via container (usando -f para definir envelope sender)
    docker exec -i onlitec_postfix sendmail -f "$FROM" -t < $EMAIL_TEMP
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Email enviado para a fila do Postfix!${NC}"
        echo ""
        echo "Verificando logs de entrega (aguarde 5 segundos)..."
        sleep 5
        docker logs onlitec_postfix --tail 20 2>&1 | grep -E "(from=|to=|status=|relay=)"
    else
        echo -e "${RED}✗ Falha no envio${NC}"
    fi
    
    rm -f $EMAIL_TEMP
fi

echo ""
echo "================================================"
echo "Para ver logs detalhados:"
echo "  docker logs onlitec_postfix --tail 50 | grep -E 'status=|relay='"
echo ""
echo "Para ver a fila:"
echo "  docker exec onlitec_postfix postqueue -p"
echo "================================================"
