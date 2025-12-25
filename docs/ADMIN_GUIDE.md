# 🎛️ GUIA DE ACESSO E ADMINISTRAÇÃO - Onlitec Email Protection

## 📋 VISÃO GERAL

Existem **3 formas principais** de acessar e administrar o sistema:

1. **🖥️ Script de Administração Interativo** (Recomendado - Mais Fácil)
2. **🌐 Rspamd Web UI** (Monitoramento e Estatísticas)
3. **💾 PostgreSQL Direto** (Administração Avançada)

---

## 🖥️ OPÇÃO 1: SCRIPT DE ADMINISTRAÇÃO INTERATIVO (RECOMENDADO)

### **O QUE É?**
Um script interativo com menu que facilita todas as operações administrativas sem precisar escrever SQL.

### **COMO ACESSAR:**

```bash
# Entre no diretório do projeto
cd /home/alfreire/docker/apps/onlitec-email

# Execute o script de administração
sudo ./scripts/admin.sh
```

### **MENU PRINCIPAL:**

```
==========================================
   Onlitec Email Protection - Admin
==========================================

Escolha uma opção:

  1) Gerenciar Tenants (Clientes)
  2) Gerenciar Domínios
  3) Gerenciar Usuários/Emails
  4) Configurar Relay
  5) Configurar Políticas de Spam
  6) Whitelist/Blacklist
  7) Ver Quarentena
  8) Ver Estatísticas
  9) Gerar Chaves DKIM
  0) Sair
```

### **GUIA PASSO-A-PASSO: CONFIGURAR PRIMEIRO CLIENTE**

#### **PASSO 1: Criar Tenant (Cliente)**
```
Menu → 1 (Gerenciar Tenants) → 2 (Criar novo tenant)

Nome do Cliente: Acme Corporation
Slug: acme-corp
Máximo de domínios: 10
Máximo de usuários: 100
```

#### **PASSO 2: Adicionar Domínio**
```
Menu → 2 (Gerenciar Domínios) → 2 (Adicionar domínio)

Slug do tenant: acme-corp
Domínio: acme.com
```

#### **PASSO 3: Configurar Relay do Domínio**
```
Menu → 2 (Gerenciar Domínios) → 3 (Configurar relay)

Digite o domínio: acme.com
Servidor de destino: mail.acme.com
Porta: 25
Usar TLS: S
Precisa de autenticação: N
```

**Se precisar de autenticação SMTP:**
```
Precisa de autenticação: S
Usuário SMTP: relay@acme.com
Senha SMTP: ********
```

#### **PASSO 4: Gerar Chaves DKIM**
```
Menu → 9 (Gerar Chaves DKIM)

Digite o domínio: acme.com
Seletor: default
```

O script mostrará o registro DNS que o cliente deve publicar.

#### **PASSO 5: Adicionar Emails/Aliases (Opcional)**
```
Menu → 3 (Gerenciar Usuários/Emails) → 3 (Adicionar alias)

Domínio: acme.com
Email de origem: contato@acme.com
Email de destino: suporte@acme.com
```

### **FUNCIONALIDADES DO SCRIPT:**

| Menu | Função | Descrição |
|------|--------|-----------|
| 1 | Tenants | Criar, listar, desativar clientes |
| 2 | Domínios | Adicionar, configurar relay, ver configuração |
| 3 | Usuários | Criar usuários, aliases, forwards |
| 4 | Relay | Atalho para configurar relay |
| 5 | Políticas | Ver políticas de spam |
| 6 | Listas | Whitelist e Blacklist |
| 7 | Quarentena | Ver emails em quarentena |
| 8 | Estatísticas | Ver estatísticas dos últimos 7 dias |
| 9 | DKIM | Gerar chaves DKIM |

---

## 🌐 OPÇÃO 2: RSPAMD WEB UI (MONITORAMENTO)

### **O QUE É?**
Interface web nativa do Rspamd para monitoramento em tempo real, estatísticas e configurações de spam.

### **COMO ACESSAR:**

1. **Abra o navegador**
2. **Acesse:** `http://localhost:11334` ou `http://SEU_IP:11334`
3. **Senha:** `changeme123` (configurável em `.env`)

### **O QUE VOCÊ PODE VER:**

- ✅ **History:** Histórico de emails processados em tempo real
- ✅ **Throughput:** Taxa de processamento de emails
- ✅ **Scan:** Analisar emails manualmente
- ✅ **Learning:** Treinar filtro bayesiano
- ✅ **Symbols:** Ver regras de spam ativas
- ✅ **Configuration:** Configurações do Rspamd

### **LIMITAÇÕES:**
- ⚠️ Não gerencia tenants/domínios
- ⚠️ Não configura relay
- ⚠️ Foco em monitoramento de spam, não em administração geral

### **CAPTURAS DE TELA:**

**Dashboard Principal:**
```
┌─────────────────────────────────────┐
│ Rspamd Web Interface                │
├─────────────────────────────────────┤
│ Throughput: 150 msgs/min            │
│ Spam Rate: 12.5%                    │
│ Clean Messages: 87.5%               │
│                                     │
│ [History] [Scan] [Learning] [Cfg]  │
└─────────────────────────────────────┘
```

---

## 💾 OPÇÃO 3: POSTGRESQL DIRETO (ADMINISTRAÇÃO AVANÇADA)

### **COMO ACESSAR:**

```bash
# Conectar ao PostgreSQL
sudo docker exec -it onlitec_emailprotect_db psql -U emailprotect emailprotect
```

### **COMANDOS ÚTEIS:**

#### **Listar tenants:**
```sql
SELECT id, name, slug, status FROM tenants WHERE deleted_at IS NULL;
```

#### **Criar tenant:**
```sql
INSERT INTO tenants (name, slug, status)
VALUES ('Acme Corp', 'acme-corp', 'active')
RETURNING id;
```

#### **Adicionar domínio:**
```sql
-- Substitua TENANT_ID pelo UUID retornado acima
INSERT INTO domains (tenant_id, domain, status)
VALUES ('TENANT_ID', 'acme.com', 'active');
```

#### **Configurar relay:**
```sql
UPDATE domains
SET 
    relay_host = 'mail.acme.com',
    relay_port = 25,
    relay_use_tls = true
WHERE domain = 'acme.com';
```

#### **Configurar relay com autenticação:**
```sql
UPDATE domains
SET 
    relay_host = 'smtp.office365.com',
    relay_port = 587,
    relay_use_tls = true,
    relay_username = 'relay@acme.com',
    relay_password = 'senha_segura'
WHERE domain = 'acme.com';
```

#### **Ver configuração de domínio:**
```sql
SELECT 
    domain,
    relay_host,
    relay_port,
    relay_use_tls,
    CASE WHEN relay_username IS NOT NULL THEN 'Sim' ELSE 'Não' END as auth
FROM domains
WHERE domain = 'acme.com';
```

#### **Listar todos os domínios com relay:**
```sql
SELECT 
    d.domain,
    t.name as tenant,
    d.relay_host,
    d.relay_port
FROM domains d
JOIN tenants t ON d.tenant_id = t.id
WHERE d.relay_host IS NOT NULL
ORDER BY d.domain;
```

#### **Ver estatísticas:**
```sql
SELECT 
    t.name as tenant,
    SUM(total_received) as recebidos,
    SUM(total_spam) as spam,
    SUM(total_virus) as virus,
    SUM(total_rejected) as rejeitados
FROM daily_stats ds
JOIN tenants t ON ds.tenant_id = t.id
WHERE ds.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY t.name;
```

#### **Ver quarentena:**
```sql
SELECT 
    TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as data,
    from_address,
    to_address,
    subject,
    reason,
    spam_score
FROM quarantine
WHERE status = 'quarantined'
ORDER BY created_at DESC
LIMIT 20;
```

#### **Adicionar à whitelist:**
```sql
-- Substitua TENANT_ID
INSERT INTO whitelist (tenant_id, type, value, comment)
VALUES ('TENANT_ID', 'email', 'cliente@confiavel.com', 'Cliente VIP');
```

#### **Adicionar à blacklist:**
```sql
-- Substitua TENANT_ID
INSERT INTO blacklist (tenant_id, type, value, comment)
VALUES ('TENANT_ID', 'domain', 'spam.com', 'Domínio de spam');
```

---

## 🔄 FLUXO COMPLETO: CONFIGURAR NOVO CLIENTE

### **MÉTODO 1: Usando Script Admin (Recomendado)**

```bash
# 1. Executar script
sudo ./scripts/admin.sh

# 2. Criar tenant
Menu → 1 → 2
Nome: Acme Corporation
Slug: acme-corp

# 3. Adicionar domínio
Menu → 2 → 2
Tenant: acme-corp
Domínio: acme.com

# 4. Configurar relay
Menu → 2 → 3
Domínio: acme.com
Servidor: mail.acme.com
Porta: 25

# 5. Gerar DKIM
Menu → 9
Domínio: acme.com

# 6. Fornecer DNS ao cliente
(O script exibe automaticamente)
```

### **MÉTODO 2: Usando SQL**

```sql
-- 1. Criar tenant
INSERT INTO tenants (name, slug) VALUES ('Acme Corp', 'acme-corp') RETURNING id;
-- Anote o ID retornado (ex: 12345678-xxxx-xxxx-xxxx)

-- 2. Adicionar domínio
INSERT INTO domains (tenant_id, domain, status)
VALUES ('12345678-xxxx-xxxx-xxxx', 'acme.com', 'active');

-- 3. Configurar relay
UPDATE domains
SET relay_host = 'mail.acme.com', relay_port = 25, relay_use_tls = true
WHERE domain = 'acme.com';

-- 4. Criar política padrão
INSERT INTO spam_policies (tenant_id, name, is_default)
VALUES ('12345678-xxxx-xxxx-xxxx', 'Política Padrão', true);
```

```bash
# 5. Gerar DKIM
sudo ./scripts/generate_dkim.sh acme.com
```

---

## 📊 COMPARAÇÃO DAS OPÇÕES

| Recurso | Script Admin | Rspamd UI | PostgreSQL |
|---------|-------------|-----------|------------|
| **Facilidade** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Gerenciar Tenants** | ✅ | ❌ | ✅ |
| **Gerenciar Domínios** | ✅ | ❌ | ✅ |
| **Configurar Relay** | ✅ | ❌ | ✅ |
| **Gerar DKIM** | ✅ | ❌ | ⚠️ Via script |
| **Monitorar Spam** | ⚠️ Básico | ✅ | ⚠️ Queries |
| **Estatísticas** | ✅ | ✅ | ✅ |
| **Quarentena** | ✅ Visualizar | ✅ Gerenciar | ✅ |
| **Whitelist/Blacklist** | ✅ | ⚠️ Limitado | ✅ |

---

## 🎯 RECOMENDAÇÕES

### **Para Administração Diária:**
✅ **Use o Script Admin** (`./scripts/admin.sh`)
- Interface amigável
- Todas as funções em um só lugar
- Não precisa saber SQL

### **Para Monitoramento de Spam:**
🌐 **Use Rspamd Web UI** (`http://localhost:11334`)
- Ver emails em tempo real
- Analisar scores de spam
- Treinar filtro bayesiano

### **Para Tarefas Avançadas:**
💾 **Use PostgreSQL Direto**
- Queries complexas
- Relatórios customizados
- Bulk operations

---

## 📝 EXEMPLOS PRÁTICOS

### **Exemplo 1: Configurar Cliente Novo (Completo)**

```bash
# Executar script admin
sudo ./scripts/admin.sh

# Seguir os passos:
1. Menu 1 → 2 (Criar tenant "Empresa XYZ")
2. Menu 2 → 2 (Adicionar domínio "xyz.com")
3. Menu 2 → 3 (Configurar relay para "mail.xyz.com:25")
4. Menu 9 (Gerar DKIM para "xyz.com")
5. Fornecer DNS ao cliente
6. Menu 8 (Verificar estatísticas)
```

### **Exemplo 2: Adicionar Email Alias**

```bash
sudo ./scripts/admin.sh
# Menu 3 → 3
# Domínio: xyz.com
# De: vendas@xyz.com
# Para: comercial@xyz.com,atendimento@xyz.com
```

### **Exemplo 3: Bloquear Spammer**

```bash
sudo ./scripts/admin.sh
# Menu 6 → 4 (Blacklist)
# Tenant: empresa-xyz
# Tipo: 1 (Email)
# Valor: spammer@malicioso.com
```

---

## 🔧 CONFIGURAÇÕES IMPORTANTES

### **Alterar Senha do Rspamd:**
```bash
# Editar arquivo .env
RSPAMD_PASSWORD=sua_nova_senha

# Reiniciar
sudo docker compose restart onlitec_rspamd
```

### **Alterar Configurações de Banco:**
```bash
# Editar arquivo .env
POSTGRES_PASSWORD=nova_senha_segura

# Atualizar scripts
# Editar scripts/admin.sh e alterar DB_PASSWORD
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **Guia DNS:** `/docs/DNS_CONFIGURATION.md`
- **Guia Relay:** `/docs/RELAY_SETUP.md`
- **Análise Técnica:** `/TECHNICAL_ANALYSIS.md`
- **Conclusão Implementação:** `/IMPLEMENTATION_COMPLETE.md`

---

## ❓ TROUBLESHOOTING

### **Script admin não funciona:**
```bash
chmod +x /home/alfreire/docker/apps/onlitec-email/scripts/admin.sh
sudo ./scripts/admin.sh
```

### **Rspamd UI não carrega:**
```bash
# Verificar se está rodando
sudo docker compose ps onlitec_rspamd

# Ver logs
sudo docker logs onlitec_rspamd

# Verificar porta
netstat -tlnp | grep 11334
```

### **Não consegue conectar ao PostgreSQL:**
```bash
# Verificar container
sudo docker compose ps onlitec_emailprotect_db

# Testar conexão
sudo docker exec -it onlitec_emailprotect_db psql -U emailprotect -d emailprotect -c "SELECT 1;"
```

---

**Pronto para usar! Comece pelo Script Admin para facilitar sua vida! 🚀**

**Última atualização:** 2024-12-24  
**Versão:** 1.0.0
