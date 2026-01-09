# 🛡️ Onlitec Email Protection

[![Version](https://img.shields.io/badge/version-v2.0.3-blue.svg)](https://github.com/onlitec/onlitec-email-security/releases/tag/v2.0.3)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](docker-compose.yml)
[![Status](https://img.shields.io/badge/status-Production%20Ready-success.svg)]()

Sistema enterprise de proteção de email multi-tenant com painel web administrativo, integração de IA para detecção de ameaças, e monitoramento completo.

## 📋 Índice

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Instalação Rápida](#-instalação-rápida)
- [Instalação Completa](#-instalação-completa)
- [Configuração](#-configuração)
- [Arquitetura](#-arquitetura)
- [Uso](#-uso)
- [API](#-api)
- [Monitoramento](#-monitoramento)
- [Backup e Restore](#-backup-e-restore)
- [Troubleshooting](#-troubleshooting)
- [Changelog](#-changelog)
- [Suporte](#-suporte)

---

## ✨ Características

### 🔐 Segurança
- **Anti-Spam**: Rspamd com machine learning e regras personalizadas
- **Antivírus**: ClamAV com atualizações automáticas
- **IA**: Detecção avançada de phishing e fraudes com AI Engine
- **TLS/SSL**: Criptografia em trânsito (STARTTLS + SMTPS)
- **SPF/DKIM/DMARC**: Validação completa de autenticidade

### 🏢 Multi-Tenant
- Isolamento completo entre tenants
- Políticas de spam personalizadas por domínio
- Whitelist/Blacklist por tenant
- Quarentena separada
- Estatísticas individuais

### 📊 Painel Web
- Dashboard com estatísticas em tempo real
- Gestão de domínios e usuários
- Visualização de quarentena
- Logs e auditoria
- Fila de emails (Postfix)
- Gerenciamento de AI Verdicts

### 🔧 Operacional
- Deploy via Docker Compose
- Auto-deploy via webhook GitHub
- Backup e restore automatizados
- Prometheus metrics
- Health checks integrados

---

## 📦 Requisitos

### Hardware Mínimo
| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disco | 20 GB | 100+ GB |

### Software
- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git**
- **Servidor Linux** (Ubuntu 22.04+ recomendado)

### Rede
| Porta | Serviço | Descrição |
|-------|---------|-----------|
| 25 | SMTP | Recebimento de emails |
| 587 | Submission | Envio autenticado |
| 465 | SMTPS | SMTP over SSL |
| 9080 | Painel Web | Interface administrativa |
| 11334 | Rspamd | Interface Rspamd (opcional) |

---

## 🚀 Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/onlitec/onlitec-email-security.git
cd onlitec-email-security

# 2. Configure as variáveis de ambiente
cp .env.example .env
nano .env  # Edite as senhas e configurações

# 3. Inicie os containers
docker compose up -d

# 4. Verifique o status
docker compose ps

# 5. Acesse o painel
# https://seu-dominio:9080
```

**Tempo estimado: ~10 minutos**

---

## 📖 Instalação Completa

### Passo 1: Preparar o Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker (se não instalado)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin
```

### Passo 2: Clonar e Configurar

```bash
# Clonar repositório
cd /opt  # ou seu diretório preferido
git clone https://github.com/onlitec/onlitec-email-security.git
cd onlitec-email-security

# Copiar arquivo de configuração
cp .env.example .env

# Editar configurações
nano .env
```

### Passo 3: Configurar .env

```env
# ======================
# DATABASE CONFIGURATION
# ======================
POSTGRES_DB=emailprotect
POSTGRES_USER=emailprotect
POSTGRES_PASSWORD=SUA_SENHA_FORTE_AQUI    # ALTERE!

# ======================
# MAIL SERVER SETTINGS
# ======================
MAIL_HOSTNAME=mail.seudominio.com.br
MAIL_DOMAIN=seudominio.com.br

# ======================
# WEB PANEL SETTINGS
# ======================
JWT_SECRET=gere_um_secret_aleatorio_aqui  # ALTERE!
SESSION_SECRET=outro_secret_aleatorio      # ALTERE!
ADMIN_EMAIL=admin@seudominio.com.br
ADMIN_PASSWORD=SUA_SENHA_ADMIN             # ALTERE!

# ======================
# RSPAMD SETTINGS
# ======================
RSPAMD_PASSWORD=senha_rspamd               # ALTERE!
```

### Passo 4: Configurar Certificados SSL

```bash
# Criar diretório de certificados
mkdir -p certs

# Opção 1: Let's Encrypt (recomendado)
# Instale certbot e obtenha certificados

# Opção 2: Certificado auto-assinado (apenas teste)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/CN=mail.seudominio.com.br"
```

### Passo 5: Iniciar Serviços

```bash
# Build e start
docker compose up -d --build

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f
```

### Passo 6: Configurar DNS

Adicione os seguintes registros DNS:

| Tipo | Nome | Valor |
|------|------|-------|
| A | mail | IP_DO_SERVIDOR |
| MX | @ | mail.seudominio.com.br (priority 10) |
| TXT | @ | v=spf1 mx -all |

---

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | **Obrigatório** |
| `JWT_SECRET` | Secret para tokens JWT | **Obrigatório** |
| `MAIL_HOSTNAME` | Hostname do servidor | mail.localhost |
| `RSPAMD_PASSWORD` | Senha da interface Rspamd | - |
| `LOG_LEVEL` | Nível de log (debug/info/warn/error) | info |

### Containers

| Container | Função | Porta |
|-----------|--------|-------|
| `onlitec_emailprotect_db` | PostgreSQL 15 | 5432 |
| `onlitec_redis` | Redis Cache | 6379 |
| `onlitec_postfix` | Servidor SMTP | 25, 587, 465 |
| `onlitec_rspamd` | Anti-spam | 11334 |
| `onlitec_clamav` | Antivírus | 3310 |
| `onlitec_emailprotect_panel` | Painel Web | 9080 |
| `onlitec_ai_engine` | IA Engine | 8000 |
| `onlitec_pdf_analyzer` | Analisador PDF | 8001 |
| `onlitec_url_intel` | URL Intelligence | 8002 |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  POSTFIX  │ ← SMTP (25/587/465)
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │  RSPAMD   │   │  CLAMAV   │   │ AI ENGINE │
    │Anti-Spam  │   │ Antivírus │   │  ML/NLP   │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
                    ┌─────▼─────┐
                    │   REDIS   │ ← Cache
                    └─────┬─────┘
                          │
                    ┌─────▼──────┐
                    │ POSTGRESQL │ ← Database
                    └─────┬──────┘
                          │
                    ┌─────▼─────┐
                    │   PANEL   │ ← Web Interface (9080)
                    └───────────┘
```

---

## 💡 Uso

### Acessar o Painel

```
URL: https://seu-dominio:9080
Usuário: admin@seudominio.com (ou o email definido no .env)
Senha: a definida no .env
```

### Criar Domínio

1. Acesse o painel web
2. Navegue até **Domínios**
3. Clique em **Adicionar Domínio**
4. Preencha os dados e salve

### Gerenciar Quarentena

1. Acesse **Quarentena** no menu
2. Visualize emails retidos
3. Liberar ou rejeitar conforme necessário

### Verificar Logs

```bash
# Todos os logs
docker compose logs -f

# Apenas Postfix
docker logs -f onlitec_postfix

# Apenas Panel
docker logs -f onlitec_emailprotect_panel
```

---

## 🔌 API

### Autenticação

```bash
# Login
curl -X POST https://seu-dominio:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@exemplo.com", "password": "senha"}'
```

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats` | Estatísticas do dashboard |
| GET | `/api/domains` | Listar domínios |
| POST | `/api/domains` | Criar domínio |
| GET | `/api/quarantine` | Listar quarentena |
| POST | `/api/quarantine/:id/release` | Liberar email |
| GET | `/api/logs` | Logs de emails |
| GET | `/health` | Health check |

---

## 📊 Monitoramento

### Prometheus Metrics

```
URL: https://seu-dominio:9080/metrics
```

### Health Check

```bash
curl https://seu-dominio:9080/health
```

---

## 💾 Backup e Restore

### Backup Manual

```bash
./scripts/backup.sh
```

### Restore

```bash
./scripts/restore.sh backup_20260109.tar.gz
```

### Backup Automático

Configure um cron job:

```bash
# Backup diário às 2h
0 2 * * * /opt/onlitec-email-security/scripts/backup.sh
```

---

## 🔧 Troubleshooting

### Container não inicia

```bash
docker compose logs nome_container
docker compose ps
```

### Erro de permissão

```bash
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### Email não chega

1. Verificar se a porta 25 está aberta
2. Verificar registros DNS (MX, SPF)
3. Verificar logs do Postfix

Mais soluções: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📝 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para histórico completo.

### v2.0.3 (2026-01-09)
- fix: Correção de paths para diretório de produção
- fix: Normalização de roles (super-admin/superadmin)
- fix: Correção de JOIN ai_verdicts
- feat: GitHub Actions CI/CD

---

## 📞 Suporte

### Documentação
- [Guia de Implementação](IMPLEMENTATION_GUIDE.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

### Contato
- **Website**: https://onlitec.com.br
- **Email**: suporte@onlitec.com.br
- **Issues**: [GitHub Issues](https://github.com/onlitec/onlitec-email-security/issues)

---

## 📄 Licença

Copyright © 2025-2026 Onlitec. Todos os direitos reservados.

---

**Versão:** v2.0.3 | **Atualizado:** 2026-01-09 | **Status:** ✅ Production Ready
