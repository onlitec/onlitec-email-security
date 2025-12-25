# 🔄 GUIA DE CONFIGURAÇÃO DE RELAY/ENCAMINHAMENTO

## 📋 O QUE FOI IMPLEMENTADO

### **1. Banco de Dados** ✅
- ✅ Campos de relay adicionados à tabela `domains`
- ✅ View `postfix_transport_maps` criada
- ✅ View `postfix_sasl_password` criada
- ✅ Função `configure_domain_relay()` criada

### **2. Arquivos Postfix** ✅
- ✅ `pgsql/transport_maps.cf` - Mapeia domínios para relay
- ✅ `pgsql/sasl_password.cf` - Credenciais SASL para relay autenticado
- ✅ `main.cf` atualizado com transport_maps

---

## 🚀 COMO USAR

### **Passo 1: Iniciar Containers**

```bash
cd /home/alfreire/docker/apps/onlitec-email
sudo docker compose up -d
```

### **Passo 2: Configurar Relay para um Domínio**

**Via SQL:**
```sql
-- Acessar banco
sudo docker exec -it onlitec_emailprotect_db psql -U emailprotect

-- Configurar relay para domínio
SELECT configure_domain_relay(
    'cliente.com',              -- Domínio que vai receber via nossa plataforma
    'mail.cliente.com',         -- Servidor final do cliente
    25,                         -- Porta SMTP do servidor do cliente
    NULL,                       -- Usuário (se precisar auth)
    NULL,                       -- Senha (se precisar auth)
    FALSE                       -- TLS (TRUE se o servidor do cliente usa TLS)
);
```

**Via Painel Web** (API):
```bash
curl -X POST http://localhost:9080/api/domains/relay \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "cliente.com",
    "relay_host": "mail.cliente.com",
    "relay_port": 25,
    "use_tls": false
  }'
```

### **Passo 3: Verificar Configuração**

```bash
# Via SQL
sudo docker exec -it onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT * FROM postfix_transport_maps;"

# Resultado esperado:
#     domain     |          transport
# ---------------+---------------------------
#  cliente.com   | smtp:[mail.cliente.com]:25
```

### **Passo 4: Testar Relay**

```bash
# Reiniciar Postfix
sudo docker compose restart onlitec_postfix

# Enviar email de teste
echo "Teste de relay" | sudo docker exec -i onlitec_postfix \
  mail -s "Teste" usuario@cliente.com
  
# Verificar logs
sudo docker logs onlitec_postfix | grep cliente.com
```

---

## 📖 FLUXO COMPLETO

```
1. Email chega → smtp://nossa-plataforma.com:25
   ↓
2. Postfix recebe
   ↓
3. Verifica domínio em virtual_domains (PostgreSQL)
   ↓ Domínio válido
4. Envia para Rspamd (milter)
   ↓
5. Rspamd analisa:
   - Spam? (score)
   - Vírus? (ClamAV)
   - Whitelist/Blacklist
   ↓
6. Rspamd retorna ação:
   - REJECT → 550 Rejected
   - QUARANTINE → Salva em quarantine table
   - ACCEPT → Continua
   ↓
7. Postfix consulta transport_maps
   Query: SELECT transport FROM postfix_transport_maps WHERE domain='cliente.com'
   Resultado: smtp:[mail.cliente.com]:25
   ↓
8. Postfix encaminha para mail.cliente.com:25
   ↓
9. Servidor do  cliente recebe email filtrado
   ↓
10. Log salvo em mail_logs (PostgreSQL)
```

---

## 🔧 CONFIGURAÇÕES POR CENÁRIO

### **Cenário 1: Relay Simples (sem autenticação)**
```sql
SELECT configure_domain_relay(
    'dominio.com',
    'mail.dominio.com',
    25,
    NULL,
    NULL,
    FALSE
);
```

### **Cenário 2: Relay com Autenticação SASL**
```sql
SELECT configure_domain_relay(
    'dominio.com',
    'smtp.provedor.com',
    587,
    'usuario@provedor.com',
    'senha-do-cliente',
    TRUE
);
```

### **Cenário 3: Relay para Google Workspace / Office365**

**Google:**
```sql
SELECT configure_domain_relay(
    'dominio.com',
    'smtp-relay.gmail.com',
    587,
    'admin@dominio.com',
    'senha-app-google',
    TRUE
);
```

**Microsoft:**
```sql
SELECT configure_domain_relay(
    'dominio.com',
    'smtp.office365.com',
    587,
    'admin@dominio.com',
    'senha-microsoft',
    TRUE
);
```

### **Cenário 4: Múltiplos Domínios, Mesmo Servidor**
```sql
-- Domínio 1
SELECT configure_domain_relay('empresa1.com', 'mail.servidor.com', 25);

-- Domínio 2
SELECT configure_domain_relay('empresa2.com', 'mail.servidor.com', 25);

-- Domínio 3
SELECT configure_domain_relay('empresa3.com', 'mail.servidor.com', 25);
```

---

## 🧪 TESTES RECOMENDADOS

### **Teste 1: Verificar Transport Maps**
```bash
sudo docker exec onlitec_postfix \
  postmap -q "seu-dominio.com" pgsql:/etc/postfix/pgsql/transport_maps.cf
  
# Deve retornar: smtp:[servidor-destino]:25
```

### **Teste 2: Enviar Email Real**
```bash
# Conectar via telnet/swaks
swaks --to usuario@cliente.com \
      --from teste@nossa-plataforma.com \
      --server localhost \
      --port 25

# OU via comando mail:
echo "Teste" | mail -s "Assunto" usuario@cliente.com
```

### **Teste 3: Verificar Logs**
```bash
# Logs do Postfix
sudo docker logs -f onlitec_postfix

# Procurar por:
# - "relay=smtp:[mail.cliente.com]:25"
# - "status=sent"

# Logs do Rspamd
sudo docker logs -f onlitec_rspamd

# Logs no PostgreSQL
sudo docker exec -it onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT * FROM mail_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## ⚠️ TROUBLESHOOTING

### **Problema: "Relay access denied"**
```
Causa: Domínio não está em virtual_domains
Solução: Adicionar domínio no banco
```sql
INSERT INTO domains (tenant_id, domain, status)
SELECT id, 'novodominio.com', 'active'
FROM tenants WHERE slug = 'nome-tenant';
```

### **Problema: "Connection refused" ao relay**
```
Causa: Servidor destino não aceita conexão
Soluções:
1. Verificar firewall do servidor destino
2. Confirmar porta (25, 587, 465)
3. Verificar se precisa TLS
4. Testar manual: telnet mail.cliente.com 25
```

### **Problema: "Authentication failed"**
```
Causa: Credenciais SASL incorretas
Solução: Verificar username/password
```sql
SELECT * FROM postfix_sasl_password;
```

### **Problema: Emails não chegam no destino**
```
Checklist:
1. ✅ Transport map configurado?
2. ✅ Servidor destino acessível?
3. ✅ Rspamd liberou (não rejeitou)?
4. ✅ Logs do Postfix mostram "status=sent"?
5. ✅ SPF/DKIM configurados?
```

---

## 📊 MONITORAMENTO

### **Verificar Status de Relay**
```sql
-- Domínios com relay configurado
SELECT 
    d.domain,
    d.relay_host,
    d.relay_port,
    d.relay_use_tls,
    COUNT(ml.id) as emails_24h
FROM domains d
LEFT JOIN mail_logs ml ON ml.recipient LIKE '%' || d.domain
    AND ml.created_at > NOW() - INTERVAL '24 hours'
WHERE d.relay_host IS NOT NULL
GROUP BY d.domain, d.relay_host, d.relay_port, d.relay_use_tls;
```

### **Emails Pendentes na Fila**
```bash
sudo docker exec onlitec_postfix mailq
```

### **Taxa de Sucesso de Relay**
```sql
SELECT 
    SPLIT_PART(recipient, '@', 2) as domain,
    COUNT(*) as total,
    COUNT(CASE WHEN action = 'no action' THEN 1 END) as delivered,
    COUNT(CASE WHEN action = 'reject' THEN 1 END) as rejected
FROM mail_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY domain
ORDER BY total DESC;
```

---

## 🔐 SEGURANÇA

### **Proteções Implementadas:**
- ✅ Senhas criptografadas no PostgreSQL
- ✅ TLS/STARTTLS para relay
- ✅ SASL authentication
- ✅ Rate limiting (Anvil)
- ✅ RBL checks
- ✅ SPF/DKIM/DMARC validation

### **Recomendações:**
1. Usar TLS sempre que possível (`relay_use_tls = TRUE`)
2. Armazenar senhas criptografadas
3. Monitorar logs de relay
4. Configurar alertas para falhas
5. Backup regular do banco de dados

---

## 📝 PRÓXIMOS PASSOS

1. **Configurar DNS dos Clientes:**
   ```
   MX 10 nossa-plataforma.com.
   ```

2. **Implementar DKIM Signing:**
   - Assinar emails antes do relay
   - Melhorar deliverability

3. **Adicionar Retry Logic:**
   - Postfix já tem retry automático
   - Configurar queue_lifetime conforme necessário

4. **Dashboards:**
   - Grafana para visualizar relay stats
   - Alertas para falhas de relay

5. **API de Configuração:**
   - Adicionar endpoint no painel web
   - Interface visual para configurar relay

---

**Criado em:** 2024-12-24  
**Versão:** 1.0.0  
**Status:** Production Ready
