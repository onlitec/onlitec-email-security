# Guia de Deploy para Produção - Portainer

Este guia explica como atualizar a versão do **onlitec-email-security** em produção usando Portainer.

## Pré-requisitos

- Acesso ao Portainer no VPS de produção
- Repositório GitHub atualizado (já fizemos o push)
- O arquivo `docker-compose.portainer.yml` configurado

---

## Opção 1: Deploy via Portainer Stack (Recomendado)

### Passo 1: Acessar o Portainer

1. Abra o Portainer no navegador: `https://seu-vps:9443` ou `http://seu-vps:9000`
2. Faça login com suas credenciais

### Passo 2: Atualizar o Stack Existente

1. No menu lateral, clique em **Stacks**
2. Clique no stack `onlitec-email-security` (ou o nome que você usou)
3. Clique em **Editor** 

### Passo 3: Atualizar o docker-compose

Copie o conteúdo do arquivo `docker-compose.portainer.yml` do repositório:

```yaml
# Cole o conteúdo do docker-compose.portainer.yml aqui
# Ou use a opção "Repository" para puxar direto do GitHub
```

### Passo 4: Configurar Variáveis de Ambiente

No Portainer, vá até a seção **Environment variables** e configure:

```env
# === DATABASE ===
POSTGRES_HOST=onlitec_emailprotect_db
POSTGRES_PORT=5432
POSTGRES_DB=emailprotect
POSTGRES_USER=emailprotect
POSTGRES_PASSWORD=<SENHA_FORTE_AQUI>

# === REDIS ===
REDIS_HOST=onlitec_redis
REDIS_PORT=6379

# === SECURITY ===
JWT_SECRET=<GERAR_COM_openssl_rand_-hex_64>
SESSION_SECRET=<GERAR_COM_openssl_rand_-hex_32>

# === RSPAMD ===
RSPAMD_PASSWORD=<SENHA_FORTE_AQUI>

# === MAIL ===
MAIL_HOSTNAME=mail.seudominio.com
MAIL_DOMAIN=seudominio.com

# === URLS (ajustar para produção) ===
APP_URL=https://mail.seudominio.com
API_URL=https://mail.seudominio.com/api
CORS_ORIGIN=https://mail.seudominio.com

# === ADMIN ===
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=<SENHA_ADMIN_FORTE>

# === AI SERVICES (novo) ===
AI_ENGINE_HOST=onlitec_ai_engine
PDF_ANALYZER_HOST=onlitec_pdf_analyzer
URL_INTEL_HOST=onlitec_url_intel
```

### Passo 5: Deploy

1. Clique em **Update the stack**
2. Marque a opção **Re-pull image and redeploy** se as imagens mudaram
3. Clique em **Update**

---

## Opção 2: Deploy via Git Repository (Automático)

### Passo 1: Criar Stack do Git

1. No Portainer, vá em **Stacks** → **Add Stack**
2. Selecione **Repository**
3. Configure:
   - **Repository URL**: `https://github.com/onlitec/onlitec-email-security`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.portainer.yml`

### Passo 2: Autenticação (se repo privado)

- **Authentication**: Ativar
- **Username**: seu_usuario_github
- **Personal Access Token**: token do GitHub

### Passo 3: Variáveis de Ambiente

Adicione todas as variáveis de ambiente necessárias (mesma lista acima)

### Passo 4: Deploy

Clique em **Deploy the stack**

### Para Atualizar no Futuro

1. Faça push das mudanças para o GitHub
2. No Portainer, vá no Stack
3. Clique em **Pull and redeploy**

---

## Opção 3: Build Local + Push para Registry

Se você não quer fazer build no Portainer, pode fazer build local e enviar para um registry.

### Passo 1: Build das imagens

```bash
cd /home/alfreire/onlitec-email-security

# Tag com seu registry
docker-compose build

# Tag para o registry (exemplo Docker Hub)
docker tag onlitec-email-security_onlitec_emailprotect_panel:latest \
  seu-usuario/onlitec-panel:latest

docker tag onlitec-email-security_onlitec_ai_engine:latest \
  seu-usuario/onlitec-ai-engine:latest

docker tag onlitec-email-security_onlitec_pdf_analyzer:latest \
  seu-usuario/onlitec-pdf-analyzer:latest

docker tag onlitec-email-security_onlitec_url_intel:latest \
  seu-usuario/onlitec-url-intel:latest
```

### Passo 2: Push para Registry

```bash
docker login
docker push seu-usuario/onlitec-panel:latest
docker push seu-usuario/onlitec-ai-engine:latest
docker push seu-usuario/onlitec-pdf-analyzer:latest
docker push seu-usuario/onlitec-url-intel:latest
```

### Passo 3: Atualizar docker-compose.portainer.yml

```yaml
services:
  onlitec_emailprotect_panel:
    image: seu-usuario/onlitec-panel:latest
    # ... resto da config
  
  onlitec_ai_engine:
    image: seu-usuario/onlitec-ai-engine:latest
    # ... resto da config
```

### Passo 4: Pull no Portainer

No Portainer, clique em **Pull and redeploy**

---

## Verificação Pós-Deploy

Após o deploy, verifique:

### 1. Health dos Containers

No Portainer → Containers, todos devem mostrar status **healthy**

### 2. Logs

```bash
# Via Portainer: clique no container → Logs
# Ou via SSH:
docker logs onlitec_emailprotect_panel
docker logs onlitec_ai_engine
```

### 3. Endpoints de Health

```bash
# Panel
curl https://seu-dominio.com/health

# AI Engine (se exposto)
curl http://VPS_IP:8081/health

# PDF Analyzer
curl http://VPS_IP:8082/health

# URL Intel
curl http://VPS_IP:8083/health
```

### 4. Página de Serviços

Acesse `https://seu-dominio.com/services` e verifique se todos os serviços (incluindo AI) estão online.

---

## Rollback em Caso de Problemas

### Via Portainer

1. Vá em **Stacks** → seu stack
2. Clique em **Editor**
3. Restaure a versão anterior do docker-compose
4. Clique em **Update the stack**

### Via Docker (SSH)

```bash
# Listar imagens anteriores
docker images | grep onlitec

# Restaurar versão anterior
docker-compose down
git checkout <commit-anterior>
docker-compose up -d
```

---

## Checklist de Deploy

- [ ] Push para GitHub feito
- [ ] Variáveis de ambiente configuradas no Portainer
- [ ] Stack atualizado
- [ ] Containers healthy
- [ ] Health endpoints respondendo
- [ ] Página /services mostra AI online
- [ ] Login no painel funcionando
- [ ] Backup do banco feito antes do deploy
