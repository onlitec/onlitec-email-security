# 🛡️ Onlitec Email Protection

[![Version](https://img.shields.io/badge/version-v2.1.0-blue.svg)](https://github.com/onlitec/onlitec-email-security/releases/tag/v2.1.0)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](docker-compose.yml)
[![Status](https://img.shields.io/badge/status-Production%20Ready-success.svg)]()
[![Build Status](https://github.com/onlitec/onlitec-email-security/actions/workflows/main.yml/badge.svg)](https://github.com/onlitec/onlitec-email-security/actions)

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
- [Testes](#-testes)
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
- Testes automatizados (CI/CD)
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

---

## 🏗️ Arquitetura

O sistema é composto por uma arquitetura de microserviços orquestrada via Docker, garantindo isolamento e escalabilidade para cada componente (SMTP, Anti-Spam, AV, IA, Redis, PostgreSQL e Interface Web).

---

## 🧪 Testes

O sistema possui uma suíte de testes automatizados integrada ao CI/CD.

### Executar Testes Locais

```bash
cd panel/backend
npm install
npm test
```

### CI/CD Pipeline
Toda alteração enviada para o repositório dispara:
1. **Lint Check**: Verificação de estrutura e qualidade
2. **Backend Tests**: Execução de testes unitários e de integração
3. **Security Audit**: Auditoria de vulnerabilidades em dependências
4. **Docker Build Test**: Validação do build da imagem de produção

---

## 💾 Backup e Restore

### Backup Manual
```bash
./scripts/backup.sh
```

### Restore
```bash
./scripts/restore.sh backup_filename.tar.gz
```

---

## 📝 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para histórico completo.

### ÚLTIMA VERSÃO: v2.1.0 (2026-01-09)
- feat: Suíte de testes automatizados para backend
- feat: Pipeline CI/CD aprimorado no GitHub Actions
- docs: Documentação técnica atualizada

---

## 📞 Suporte

- **Website**: https://onlitec.com.br
- **Email**: suporte@onlitec.com.br

---

Copyright © 2025-2026 Onlitec. Todos os direitos reservados.
