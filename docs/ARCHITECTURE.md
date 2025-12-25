# Arquitetura Multi-Tenant - Onlitec Email Protection

## Visão Geral

Sistema de proteção de email multi-tenant com isolamento completo por tenant, integração entre Postfix, Rspamd, ClamAV, Redis e PostgreSQL.

## Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Firewall/UFW  │
                    │   Ports: 25,    │
                    │   465, 587      │
                    └────────┬────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    POSTFIX SMTP SERVER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Virtual Domains (PostgreSQL)                          │   │
│  │  • SASL Authentication                                   │   │
│  │  • TLS/SSL (25, 587, 465)                               │   │
│  │  • Rate Limiting (Anvil)                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
    ┌────────▼─────────┐        ┌───────▼────────┐
    │   Milter Proto   │        │  Content Filter │
    │   (Port 11332)   │        │  (Port 10024)   │
    └────────┬─────────┘        └───────┬────────┘
             │                           │
┌────────────▼───────────────────────────▼────────────────────────┐
│                    RSPAMD (Anti-Spam Engine)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Normal Worker (11333) - Processing                      │   │
│  │  Controller (11334) - Web UI & API                       │   │
│  │                                                           │   │
│  │  Modules:                                                │   │
│  │  • Multi-tenant Lua Scripts                             │   │
│  │  • Bayes Classifier (per-tenant)                        │   │
│  │  • SPF/DKIM/DMARC Validation                            │   │
│  │  • URL Filtering                                        │   │
│  │  • Greylisting                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬───────────────┬──────────────────────────┘
       │              │               │
   ┌───▼───┐    ┌────▼─────┐   ┌────▼────────┐
   │ Redis │    │  ClamAV  │   │  PostgreSQL │
   │ Cache │    │ Antivirus│   │  Policies   │
   └───────┘    └──────────┘   └─────────────┘
       │              │               │
       │         ┌────▼───┐           │
       │         │ Virus  │           │
       │         │ Scan   │           │
       │         │ 3310   │           │
       │         └────────┘           │
       │                              │
┌──────▼──────────────────────────────▼──────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Multi-Tenant Schema:                                    │   │
│  │  • tenants - Tenant definitions                         │   │
│  │  • domains - Domain per tenant                          │   │
│  │  • users - Email users                                  │   │
│  │  • virtual_addresses - Email aliases                    │   │
│  │  • spam_policies - Per-tenant policies                  │   │
│  │  • whitelist/blacklist - Per-tenant lists              │   │
│  │  • quarantine - Quarantined messages                    │   │
│  │  • mail_logs - Email transaction logs                   │   │
│  │  • daily_stats - Statistics per tenant                  │   │
│  │  • audit_log - Audit trail                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    WEB PANEL (Node.js + React)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Backend (Express.js):                                   │   │
│  │  • REST API                                              │   │
│  │  • Tenant Management                                     │   │
│  │  • User Management                                       │   │
│  │  • Policy Configuration                                  │   │
│  │  • Quarantine Management                                 │   │
│  │  • Statistics & Reports                                  │   │
│  │  • Integration with Rspamd API                          │   │
│  │                                                           │   │
│  │  Frontend (React):                                       │   │
│  │  • Tenant Dashboard                                      │   │
│  │  • Email Logs Viewer                                     │   │
│  │  • Quarantine Browser                                    │   │
│  │  • Whitelist/Blacklist Manager                          │   │
│  │  • Statistics Charts                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Processamento de Email

### 1. Email Recebido (Inbound)

```
Internet → Postfix:25 → Validação → Rspamd (Milter) → Decisão
                ↓                           ↓             ↓
           Virtual Domain              Spam Check      Accept/Reject
           PostgreSQL                  ClamAV Scan     Quarantine
                ↓                      Bayes Filter
           Tenant ID                   Tenant Policy
                ↓                           ↓
           Apply Policies ←────────────────┘
                ↓
           Deliver/Quarantine/Reject
```

**Passos Detalhados:**

1. **Conexão SMTP**: Cliente conecta na porta 25/587/465
2. **Validação Postfix**: 
   - Verifica domínio virtual (PostgreSQL)
   - Identifica Tenant ID do domínio do destinatário
   - Verifica rate limiting (Anvil)
3. **Milter Rspamd**:
   - Recebe email via protocolo Milter
   - Extrai tenant do domínio destinatário
   - Carrega política do tenant (PostgreSQL/Redis)
   - Verifica whitelist/blacklist do tenant
4. **Análise de Spam**:
   - Bayes filter (aprendizado por tenant)
   - SPF, DKIM, DMARC validation
   - URL blacklist checking
   - Content analysis
5. **Scan de Vírus**:
   - Rspamd envia para ClamAV (porta 3310)
   - ClamAV verifica signatures
   - Retorna resultado para Rspamd
6. **Decisão**:
   - Score < greylisting_threshold → Accept
   - Score < reject_threshold → Add header / Quarantine
   - Score >= reject_threshold → Reject
   - Vírus detectado → Reject / Quarantine
7. **Logging**:
   - Insere registro em `mail_logs`
   - Atualiza `daily_stats`
   - Se quarentena, insere em `quarantine`

### 2. Email Enviado (Outbound)

```
Usuário → SMTP AUTH → Postfix:587 → Rspamd Scan → Deliver
            ↓                           ↓
    PostgreSQL (SASL)            Light filtering    
    Verifica credenciais         Sign DKIM
            ↓                           ↓
    Rate limit check              Add headers
```

## Isolamento Multi-Tenant

### Nível 1: Banco de Dados

- Cada tenant tem UUID único
- Foreign keys garantem isolamento
- Queries sempre filtram por `tenant_id`
- Views PostgreSQL para Postfix já filtram por tenant

### Nível 2: Redis

- Keys prefixadas com tenant_id
  ```
  tenant:<tenant_id>:policy:*
  tenant:<tenant_id>:whitelist:email:*
  tenant:<tenant_id>:blacklist:domain:*
  tenant:domain:<domain> → <tenant_id>
  ```

### Nível 3: Rspamd

- Lua scripts extraem tenant do domínio destinatário
- Bayes learning separado por tenant (`per_user = true`)
- Políticas aplicadas dinamicamente por tenant

### Nível 4: Logs

- Todos os logs incluem `tenant_id`
- Logs em `/var/log/tenants/<domain>/mail.log` (opcional)
- Audit log rastreia ações por tenant

## Componentes Principais

### PostgreSQL (porta 5432)

**Responsabilidades:**
- Armazenar configurações multi-tenant
- Domínios e usuários virtuais
- Políticas de spam por tenant
- Quarentena
- Logs e estatísticas
- Audit trail

**Comunicação:**
- Postfix → PostgreSQL (virtual domains, mailboxes, aliases)
- Panel → PostgreSQL (API, CRUD operations)
- Rspamd → PostgreSQL (via Redis cache - futura implementação)

### Redis (porta 6379)

**Responsabilidades:**
- Cache de configurações de tenant (para performance)
- Bayes tokens (Rspamd)
- Greylisting data
- Rate limiting counters
- Sessões do painel web

**Comunicação:**
- Rspamd ↔ Redis (Bayes, greylisting, cache)
- Panel ↔ Redis (sessions, cache)

### Postfix (portas 25, 587, 465)

**Responsabilidades:**
- Receber/enviar emails
- Validar domínios virtuais (PostgreSQL)
- SASL authentication
- TLS/SSL encryption
- Rate limiting
- Integração com Rspamd (milter + content filter)

**Configurações Multi-Tenant:**
```
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql/virtual_domains.cf
virtual_mailbox_maps = pgsql:/etc/postfix/pgsql/virtual_mailboxes.cf
virtual_alias_maps = pgsql:/etc/postfix/pgsql/virtual_aliases.cf
```

### Rspamd (portas 11332, 11333, 11334)

**Responsabilidades:**
- Análise de spam multi-tenant
- Integração ClamAV
- Bayes learning per-tenant
- SPF/DKIM/DMARC validation
- Aplicar políticas por tenant
- Whitelist/Blacklist por tenant

**Workers:**
- **Normal (11333)**: Processa emails via Milter
- **Controller (11334)**: Web UI e API
- **Milter (11332)**: Protocolo Milter para Postfix

**Lua Scripts:**
- `tenant_rules.lua`: Lógica multi-tenant principal
- Extrai tenant do domínio destinatário
- Carrega política do tenant
- Aplica whitelist/blacklist
- Ajusta thresholds dinamicamente

### ClamAV (porta 3310)

**Responsabilidades:**
- Scan de vírus em anexos
- Atualização automática de signatures (freshclam)
- Integração com Rspamd

**Configuração:**
- TCP socket na porta 3310
- Rspamd chama via `antivirus.conf`
- Timeout configurável
- Tamanho máximo de scan: 50MB

### Web Panel (porta 9080)

**Responsabilidades:**
- Interface administrativa
- CRUD de tenants, domínios, usuários
- Configuração de políticas
- Visualização de logs
- Gerenciamento de quarentena
- Estatísticas e dashboards
- API REST para integrações

**Stack:**
- Backend: Node.js + Express.js
- Frontend: React (ou Vue.js)
- API: REST + JWT authentication
- Database: PostgreSQL
- Cache: Redis

## Segurança

### TLS/SSL

- **Postfix**: Suporta STARTTLS (587) e SSL (465)
- **Certificados**: Self-signed (dev) ou Let's Encrypt (prod)
- **Painel**: Nginx reverse proxy com SSL

### Autenticação

- **SMTP**: SASL via PostgreSQL
- **Painel**: JWT tokens + session management
- **API**: Bearer tokens com expiração

### Firewall

```bash
UFW Rules:
25/tcp   - SMTP
587/tcp  - Submission (STARTTLS)
465/tcp  - SMTPS
9080/tcp - Web Panel (interno, via proxy)
```

### Isolamento

- Containers em rede Docker isolada
- Cada tenant vê apenas seus dados
- Queries sempre filtradas por `tenant_id`
- Audit log de todas as ações

## Monitoramento

### Métricas Prometheus

- **Rspamd**: `/metrics` endpoint (porta 11334)
- **Postfix**: Via exporter (opcional)
- **Panel**: Custom metrics endpoint

### Logs

- **Postfix**: `/var/log/mail/mail.log`
- **Rspamd**: `/var/log/rspamd/rspamd.log`
- **ClamAV**: `/var/log/clamav/clamd.log`
- **Panel**: `/var/log/panel/app.log`

### Integração com Stack de Monitoramento

- Prometheus scraping
- Grafana dashboards
- Alertmanager para alertas críticos
- Loki para agregação de logs

## Escalabilidade

### Horizontal

- **PostgreSQL**: Primary-Replica (read replicas)
- **Redis**: Redis Sentinel ou Cluster
- **Rspamd**: Múltiplos workers
- **Postfix**: Load balancer (MX priority)

### Vertical

- Aumentar recursos de cada container
- Tuning de PostgreSQL (shared_buffers, work_mem)
- Tuning de Rspamd (workers, max_tasks)

## Backup e Restore

### Banco de Dados

```bash
# Backup
docker exec onlitec_emailprotect_db pg_dump -U emailprotect > backup.sql

# Restore
docker exec -i onlitec_emailprotect_db psql -U emailprotect < backup.sql
```

### Configurações

```bash
# Backup configs
tar -czf config_backup.tar.gz postfix/ rspamd/ clamav/

# Restore
tar -xzf config_backup.tar.gz
```

### Quarentena

- Emails quarentes armazenados em PostgreSQL (text/blob)
- Opcional: armazenar em filesystem com path no banco

## Performance

### PostgreSQL

- Indexes em colunas críticas (`tenant_id`, `domain`, `email`)
- Connection pooling (PgBouncer)
- Vacuum automático
- Particionamento de `mail_logs` por data (opcional)

### Redis

- Eviction policy: `allkeys-lru`
- Persistence: AOF + RDB
- Max memory: 256MB (ajustável)

### Rspamd

- Bayes auto-learning
- Redis backend para performance
- Multiple workers para paralelização

## Troubleshooting

Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para guia completo.

## Roadmap

- [ ] Dovecot integration (IMAP/POP3)
- [ ] DKIM key generation automática
- [ ] Webmail integration (Roundcube)
- [ ] S3 storage para quarentena
- [ ] GraphQL API
- [ ] Real-time notifications (WebSocket)
- [ ] ML-based spam detection
- [ ] Multi-region deployment
