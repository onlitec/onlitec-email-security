# 📧 CONFIGURAÇÃO DE RELAY - Onlitec Email Protection

## 📋 VISÃO GERAL

Este sistema funciona como um **Gateway de Email** (Email Relay/Filter). Os emails passam por análise antispam/antivírus e são encaminhados para o servidor de email final do cliente.

---

## 🔄 FLUXO DE EMAIL

```
Internet
   ↓
MX Record (DNS do Cliente aponta para nossa plataforma)
   ↓
Nossa Plataforma (IP: SEU_IP_AQUI)
   ├─ Recebe email (Postfix - porta 25)
   ├─ Identifica tenant pelo domínio
   ├─ Análise Rspamd (spam/vírus/autenticidade)
   ├─ Aplica políticas do tenant
   ├─ Decisão (Accept/Reject/Quarantine)
   └─ Se ACCEPT → Encaminha para servidor final do cliente
   ↓
Servidor Email Final do Cliente
   ↓
Caixa de entrada do usuário
```

---

## 🛠️ CONFIGURAÇÃO DO RELAY

### **1. Estrutura do Banco de Dados**

A tabela `domains` possui os seguintes campos para configurar relay:

```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    relay_host VARCHAR(255),          -- Servidor de destino (ex: mail.cliente.com)
    relay_port INTEGER DEFAULT 25,     -- Porta do relay (25, 587, etc)
    relay_use_tls BOOLEAN DEFAULT true, -- Usar TLS/STARTTLS
    relay_username VARCHAR(255),       -- Usuário para autenticação SMTP
    relay_password VARCHAR(255),       -- Senha para autenticação SMTP
    status VARCHAR(50) DEFAULT 'active',
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### **2. Configurar Relay para um Domínio**

**Exemplo: Cliente Acme Corp**

```sql
-- Inserir tenant
INSERT INTO tenants (name, slug, status) 
VALUES ('Acme Corp', 'acme-corp', 'active')
RETURNING id; -- Anote o ID: vamos chamar de TENANT_ID

-- Configurar domínio com relay
INSERT INTO domains (
    tenant_id,
    domain,
    relay_host,
    relay_port,
    relay_use_tls,
    relay_username,
    relay_password,
    status,
    verified
) VALUES (
    'TENANT_ID',                         -- UUID do tenant
    'acme.com',                          -- Domínio do cliente
    'mail.acme.com',                     -- Servidor final do cliente
    25,                                  -- Porta SMTP
    true,                                -- Usar TLS
    NULL,                                -- NULL se não precisa autenticação
    NULL,                                -- NULL se não precisa autenticação
    'active',
    true
);
```

**Com Autenticação SMTP (se o servidor final exigir):**

```sql
UPDATE domains
SET 
    relay_username = 'relay@acme.com',
    relay_password = 'senha_segura_aqui'
WHERE domain = 'acme.com';
```

---

## 📝 QUERY DO POSTFIX

O arquivo `/etc/postfix/pgsql/transport_maps.cf` precisa ter a query correta:

```sql
SELECT 
    CASE 
        WHEN relay_host IS NOT NULL THEN 
            'smtp:[' || relay_host || ']:' || COALESCE(relay_port::text, '25')
        ELSE 
            'virtual'
    END AS transport
FROM domains 
WHERE domain = '%s' 
AND status = 'active'
LIMIT 1;
```

Esta query retorna:
- `smtp:[mail.acme.com]:25` → Se configurado relay
- `virtual` → Se não tiver relay (modo local/virtual)

---

## 🔐 CONFIGURAR SENHAS SMTP (Se necessário)

Se o servidor final do cliente exigir autenticação, configure:

### **1. Criar tabela de senhas SASL:**

```sql
CREATE TABLE postfix_sasl_passwords (
    domain VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Popular com dados do relay
INSERT INTO postfix_sasl_passwords (domain, username, password)
SELECT domain, relay_username, relay_password
FROM domains
WHERE relay_username IS NOT NULL;
```

### **2. Configurar arquivo `/etc/postfix/pgsql/sasl_password.cf`:**

```
user = emailprotect
password = changeme123
hosts = onlitec_emailprotect_db
dbname = emailprotect
query = SELECT username || ':' || password FROM postfix_sasl_passwords WHERE domain='%s' LIMIT 1
```

---

## ✅ TESTE DE RELAY

### **1. Verificar configuração:**

```bash
# Dentro do container Postfix
docker exec -it onlitec_postfix bash

# Testar query de transport
postmap -q "acme.com" pgsql:/etc/postfix/pgsql/transport_maps.cf

# Deve retornar: smtp:[mail.acme.com]:25
```

### **2. Enviar email de teste:**

```bash
# De outro servidor ou usando swaks
swaks --to usuario@acme.com \
      --from teste@example.com \
      --server SEU_IP_AQUI \
      --port 25 \
      --header "Subject: Teste de Relay" \
      --body "Este é um teste do sistema de relay"
```

### **3. Verificar logs:**

```bash
# Logs do Postfix
docker exec onlitec_postfix tail -f /var/log/mail/mail.log

# Verificar se aparece:
# relay=mail.acme.com[IP]:25
# status=sent
```

---

## 🌍 CONFIGURAÇÃO DNS DOS CLIENTES

Para que os emails sejam recebidos pelo nosso sistema, o cliente deve configurar:

### **1. MX Record:**

```
Tipo: MX
Nome: @
Prioridade: 10
Valor: mail.onlitec.com  (ou seu domínio/IP)
TTL: 3600
```

### **2. SPF Record (Opcional mas recomendado):**

```
Tipo: TXT
Nome: @
Valor: v=spf1 ip4:SEU_IP_AQUI include:_spf.onlitec.com ~all
```

### **3. Domínio de Backup (Failover - Opcional):**

```
Tipo: MX
Nome: @
Prioridade: 20
Valor: backup.onlitec.com
```

---

## 📊 CENÁRIOS DE USO

### **Cenário 1: Relay Simples (sem autenticação)**

Cliente usa **Google Workspace** e quer apenas filtro de spam:

```sql
INSERT INTO domains (tenant_id, domain, relay_host, relay_port, relay_use_tls)
VALUES ('TENANT_ID', 'empresa.com', 'aspmx.l.google.com', 25, true);
```

### **Cenário 2: Relay com Autenticação**

Cliente tem servidor Exchange/Office 365 com SMTP autenticado:

```sql
INSERT INTO domains (
    tenant_id, domain, relay_host, relay_port, 
    relay_use_tls, relay_username, relay_password
)
VALUES (
    'TENANT_ID', 
    'empresa.com', 
    'smtp.office365.com', 
    587, 
    true, 
    'relay@empresa.com', 
    'senha_relay'
);
```

### **Cenário 3: Múltiplos Domínios para Mesmo Tenant**

```sql
-- Domínio principal
INSERT INTO domains (tenant_id, domain, relay_host)
VALUES ('TENANT_ID', 'empresa.com', 'mail.empresa.com');

-- Domínios alternativos
INSERT INTO domains (tenant_id, domain, relay_host)
VALUES ('TENANT_ID', 'empresa.com.br', 'mail.empresa.com');
```

---

## 🚨 TROUBLESHOOTING

### **Problema: "Relay access denied"**

**Causa:** Domínio não está configurado na tabela `domains`

**Solução:**
```sql
SELECT * FROM domains WHERE domain = 'dominio-problema.com';
-- Se não retornar nada, inserir o domínio
```

### **Problema: "Connection refused" ao relay**

**Causa:** Servidor final do cliente bloqueando nosso IP

**Solução:**
1. Cliente deve adicionar nosso IP na whitelist do servidor dele
2. Verificar firewall do cliente
3. Testar conectividade: `telnet mail.cliente.com 25`

### **Problema: Authentication failed**

**Causa:** Credenciais SMTP incorretas

**Solução:**
```sql
-- Verificar credenciais
SELECT relay_username, relay_password FROM domains WHERE domain = 'dominio.com';

-- Atualizar se necessário
UPDATE domains SET relay_password = 'senha_correta' WHERE domain = 'dominio.com';
```

---

## 📈 MONITORAMENTO

### **Queries Úteis:**

```sql
-- Ver todos os relays configurados
SELECT tenant_id, domain, relay_host, relay_port, status
FROM domains
WHERE relay_host IS NOT NULL;

-- Estatísticas de relay por tenant
SELECT t.name, COUNT(d.id) as total_domains, COUNT(d.relay_host) as with_relay
FROM tenants t
LEFT JOIN domains d ON t.id = d.tenant_id
GROUP BY t.id, t.name;

-- Domínios sem relay configurado
SELECT domain FROM domains WHERE relay_host IS NULL AND status = 'active';
```

---

## 🔒 SEGURANÇA

1. **Senhas criptografadas:** Considere criptografar `relay_password` no banco
2. **TLS obrigatório:** Sempre use `relay_use_tls = true` quando possível
3. **Whitelist de IPs:** Configure SPF records
4. **Logs:** Monitore tentativas de relay não autorizado

---

**Última atualização:** 2024-12-24  
**Versão:** 1.0.0
