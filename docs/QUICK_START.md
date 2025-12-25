# Guia de Início Rápido - Onlitec Email Protection

Este guia vai te ajudar a colocar o sistema multi-tenant de proteção de email em funcionamento em menos de 10 minutos.

## Pré-requisitos

- Docker e Docker Compose instalados
- Mínimo 4GB RAM disponível
- Portas disponíveis: 25, 465, 587, 3310, 5432, 6379, 9080, 11333, 11334
- Ubuntu 20.04+ ou Debian 11+ (recomendado)

## Passo 1: Preparação

```bash
# Navegar para o diretório do projeto
cd /home/alfreire/docker/apps/onlitec-email

# Copiar arquivo de configuração
cp .env.example .env

# Editar credenciais (IMPORTANTE!)
nano .env
```

**Altere no mínimo:**
- `POSTGRES_PASSWORD` - senha do banco de dados
- `ADMIN_PASSWORD` - senha do admin do painel
- `JWT_SECRET` - chave secreta JWT
- `SESSION_SECRET` - chave secreta de sessão
- `RSPAMD_PASSWORD` - senha Rspamd web UI
- `MAIL_HOSTNAME` - hostname do servidor (ex: mail.seudominio.com)

## Passo 2: Iniciar os Serviços

```bash
# Subir toda a stack
docker-compose up -d

# Verificar status dos containers
docker-compose ps
```

Todos os containers devem estar com status "Up" e "healthy":
- ✅ onlitec_emailprotect_db
- ✅ onlitec_redis
- ✅ onlitec_clamav
- ✅ onlitec_rspamd
- ✅ onlitec_postfix
- ✅ onlitec_emailprotect_panel

**Nota:** O ClamAV pode levaraté 5 minutos para baixar as signatures na primeira vez.

## Passo 3: Verificar Conectividade

```bash
# Tornar script executável
chmod +x scripts/test_connectivity.sh

# Executar teste de conectividade
./scripts/test_connectivity.sh
```

Se todos os testes passarem, você verá:
```
Tests Passed: 15
Tests Failed: 0
All tests passed!
```

## Passo 4: Acessar o Sistema

### Painel Web

Abra no navegador:
```
http://SEU_SERVIDOR:9080
```

**Credenciais padrão:**
- Email: `admin@onlitec.local`
- Senha: (definida no `.env` em `ADMIN_PASSWORD`)

### Rspamd Web UI

```
http://SEU_SERVIDOR:11334
```

**Senha:** (definida no `.env` em `RSPAMD_PASSWORD`)

## Passo 5: Criar Primeiro Tenant

```bash
# Tornar script executável
chmod +x scripts/create_tenant.sh

# Criar tenant para seu domínio
./scripts/create_tenant.sh exemplo.com "Minha Empresa" admin@exemplo.com senha123
```

O script irá:
1. Criar tenant no banco de dados
2. Criar domínio virtual
3. Criar usuário admin
4. Configurar política padrão de spam
5. Cachear no Redis
6. Recarregar Postfix

**Anote as credenciais geradas!**

## Passo 6: Configurar DNS

Para que emails sejam recebidos, configure os registros DNS:

### MX Record
```
exemplo.com.  IN  MX  10  mail.seuservidor.com.
```

### A Record
```
mail.seuservidor.com.  IN  A  SEU_IP_PUBLICO
```

### SPF Record
```
exemplo.com.  IN  TXT  "v=spf1 ip4:SEU_IP_PUBLICO ~all"
```

### DMARC Record (opcional)
```
_dmarc.exemplo.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@exemplo.com"
```

## Passo 7: Testar Envio de Email

```bash
# Tornar script executável
chmod +x scripts/test_smtp.sh

# Enviar email de teste
./scripts/test_smtp.sh exemplo.com destinatario@gmail.com
```

### Testar Detecção de Vírus

```bash
./scripts/test_smtp.sh exemplo.com destinatario@gmail.com --attach-eicar
```

**Resultado esperado:** Email rejeitado ou em quarentena (vírus detectado)

### Testar Detecção de Spam

```bash
./scripts/test_smtp.sh exemplo.com destinatario@gmail.com --spam-test
```

**Resultado esperado:** Email marcado como spam ou em quarentena

## Passo 8: Verificar Logs

### Logs de Email Processados

```bash
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT from_address, to_address, status, spam_score, created_at 
   FROM mail_logs 
   ORDER BY created_at DESC 
   LIMIT 10;"
```

### Logs de Quarentena

```bash
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT from_address, to_address, reason, spam_score, virus_name, created_at 
   FROM quarantine 
   ORDER BY created_at DESC 
   LIMIT 10;"
```

### Estatísticas do Tenant

```bash
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT t.name, d.date, d.total_received, d.total_sent, 
          d.total_spam, d.total_virus, d.total_quarantined
   FROM daily_stats d
   JOIN tenants t ON d.tenant_id = t.id
   ORDER BY d.date DESC, t.name
   LIMIT 20;"
```

## Passo 9: Configurar Firewall

```bash
# Permitir portas de email
sudo ufw allow 25/tcp
sudo ufw allow 465/tcp
sudo ufw allow 587/tcp

# Painel web (opcional, recomendado usar via proxy)
sudo ufw allow 9080/tcp

# Aplicar regras
sudo ufw reload
sudo ufw status
```

## Passo 10: SSL/TLS (Produção)

### Opção 1: Certificados Let's Encrypt (Recomendado)

Se você tem Nginx Proxy Manager instalado:

1. Adicionar proxy host para `mail.seudominio.com`
2. Apontar para `onlitec_postfix:587`
3. Habilitar SSL com Let's Encrypt
4. Copiar certificados para o container:

```bash
# Criar diretório de certificados
mkdir -p certs

# Copiar do Nginx Proxy Manager (ajuste o caminho)
cp /path/to/fullchain.pem certs/cert.pem
cp /path/to/privkey.pem certs/key.pem

# Recriar container Postfix
docker-compose up -d --force-recreate onlitec_postfix
```

### Opção 2: Certificado Auto-assinado (Desenvolvimento)

Os certificados auto-assinados são gerados automaticamente no primeiro start.

Localização: `/etc/postfix/certs/` dentro do container.

## Comandos Úteis

### Ver Logs em Tempo Real

```bash
# Todos os serviços
docker-compose logs -f

# Apenas Postfix
docker logs -f onlitec_postfix

# Apenas Rspamd
docker logs -f onlitec_rspamd

# Apenas ClamAV
docker logs -f onlitec_clamav
```

### Reiniciar Serviços

```bash
# Reiniciar tudo
docker-compose restart

# Reiniciar apenas um serviço
docker-compose restart onlitec_postfix
docker-compose restart onlitec_rspamd
```

### Parar Sistema

```bash
# Parar todos os containers
docker-compose stop

# Parar e remover (dados persistem nos volumes)
docker-compose down

# Remover TUDO incluindo volumes (CUIDADO!)
docker-compose down -v
```

### Backup do Banco de Dados

```bash
# Criar backup
docker exec onlitec_emailprotect_db pg_dump -U emailprotect emailprotect > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i onlitec_emailprotect_db psql -U emailprotect emailprotect < backup_20241224.sql
```

### Atualizar Signatures do ClamAV

```bash
docker exec onlitec_clamav freshclam
```

### Recarregar Configuração do Postfix

```bash
docker exec onlitec_postfix postfix reload
```

### Executar Comando no Rspamd

```bash
# Ver estatísticas
docker exec onlitec_rspamd rspamadm stats

# Testar configuração
docker exec onlitec_rspamd rspamadm configtest

# Ver ajuda
docker exec onlitec_rspamd rspamadm --help
```

## Troubleshooting

### Email não está sendo recebido

1. Verificar DNS (MX record)
2. Verificar firewall (portas 25, 587, 465)
3. Verificar logs do Postfix
4. Testar conectividade SMTP:
   ```bash
   telnet localhost 25
   ```

### Email está sendo marcado como spam incorretamente

1. Verificar threshold do tenant
2. Verificar whitelist
3. Treinar Bayes:
   ```bash
   # Marcar como ham (não spam)
   docker exec onlitec_rspamd rspamc learn_ham < email.eml
   ```

### ClamAV não está detectando vírus

1. Verificar se signatures estão atualizadas:
   ```bash
   docker exec onlitec_clamav freshclam
   ```
2. Verificar logs do ClamAV
3. Testar com EICAR:
   ```bash
   ./scripts/test_smtp.sh dominio.com teste@exemplo.com --attach-eicar
   ```

### Container não inicia

1. Verificar logs:
   ```bash
   docker-compose logs nome_do_container
   ```
2. Verificar se portas não estão em uso:
   ```bash
   sudo netstat -tulpn | grep LISTEN
   ```
3. Verificar recursos disponíveis:
   ```bash
   free -h
   df -h
   ```

## Próximos Passos

1. ✅ [Configuração Avançada](CONFIGURATION.md)
2. ✅ [Entender Multi-Tenant](MULTI_TENANT.md)
3. ✅ [API Reference](API.md)
4. ✅ [Arquitetura Detalhada](ARCHITECTURE.md)
5. ✅ [Monitoramento com Prometheus/Grafana](../../../monitoramento/README.md)

## Suporte

Para problemas, consulte:
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Logs dos containers
- Issues no repositório

---

**Parabéns! 🎉**

Seu sistema multi-tenant de proteção de email está funcionando!
