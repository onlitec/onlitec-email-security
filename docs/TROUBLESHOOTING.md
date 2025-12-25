# Troubleshooting - Onlitec Email Protection

Guia completo de resolução de problemas do sistema multi-tenant de proteção de email.

## 🔍 Diagnóstico Rápido

### Status dos Serviços

```bash
# Ver status de todos os containers
docker-compose ps

# Verificar health
docker ps --filter "name=onlitec_" --format "table {{.Names}}\t{{.Status}}"

# Teste automatizado de conectividade
./scripts/test_connectivity.sh
```

---

## ❌ Problemas Comuns

### 1. Container Não Inicia

#### **Sintomas:**
- Container em status "Restarting" ou "Exited"
- Erro ao executar `docker-compose up`

#### **Diagnóstico:**
```bash
# Ver logs do container
docker logs onlitec_NOME_DO_SERVIÇO

# Ver últimas 50 linhas
docker logs --tail 50 onlitec_NOME_DO_SERVIÇO

# Acompanhar logs em tempo real
docker logs -f onlitec_NOME_DO_SERVIÇO
```

#### **Soluções:**

**A) Porta já em uso:**
```bash
# Verificar portas em uso
sudo netstat -tulpn | grep LISTEN | grep -E '(25|465|587|3310|5432|6379|9080|11333|11334)'

# Matar processo na porta (exemplo porta 25)
sudo fuser -k 25/tcp

# Recriar container
docker-compose up -d onlitec_postfix
```

**B) Falta de recursos:**
```bash
# Verificar memória disponível
free -h

# Verificar disco
df -h

# Limpar containers/imagens não utilizados
docker system prune -a
```

**C) Problema de permissões:**
```bash
# Verificar proprietário dos volumes
ls -la /var/lib/docker/volumes | grep onlitec

# Recriar volume (CUIDADO: perde dados!)
docker volume rm onlitec-email_postgres_data
docker-compose up -d onlitec_emailprotect_db
```

---

### 2. PostgreSQL Não Conecta

#### **Sintomas:**
- Erro: "could not connect to server"
- Outros containers não conseguem se conectar ao banco

#### **Diagnóstico:**
```bash
# Verificar se PostgreSQL está rodando
docker exec onlitec_emailprotect_db pg_isready -U emailprotect

# Testar conexão
docker exec onlitec_emailprotect_db psql -U emailprotect -c '\l'

# Ver logs
docker logs onlitec_emailprotect_db
```

#### **Soluções:**

**A) Senha incorreta:**
```bash
# Verificar senha no .env
grep POSTGRES_PASSWORD .env

# Recriar com senha correta
docker-compose down
# Editar .env
docker-compose up -d
```

**B) Schema não inicializado:**
```bash
# Executar schema manualmente
docker exec -i onlitec_emailprotect_db psql -U emailprotect < database/schema.sql

# Executar seed
docker exec -i onlitec_emailprotect_db psql -U emailprotect < database/seed_tenant.sql
```

**C) Healthcheck falhando:**
```bash
# Verificar health status
docker inspect onlitec_emailprotect_db | grep -A 10 Health

# Forçar recreate
docker-compose up -d --force-recreate onlitec_emailprotect_db
```

---

### 3. Emails Não São Recebidos

#### **Sintomas:**
- Emails enviados não chegam
- Timeout ao conectar SMTP
- Erros de "relay denied"

#### **Diagnóstico:**
```bash
# Testar conectividade SMTP
telnet localhost 25

# Ver logs do Postfix
docker logs --tail 100 onlitec_postfix | grep -i error

# Testar de fora (substitua IP)
telnet SEU_IP_PUBLICO 25

# Verificar firewall
sudo ufw status | grep -E '(25|465|587)'
```

#### **Soluções:**

**A) Firewall bloqueando:**
```bash
# Permitir portas
sudo ufw allow 25/tcp
sudo ufw allow 465/tcp
sudo ufw allow 587/tcp
sudo ufw reload
```

**B) DNS não configurado:**
```bash
# Verificar MX record
dig MX seudominio.com

# Verificar A record
dig mail.seudominio.com

# Testar envio
./scripts/test_smtp.sh seudominio.com destinatario@gmail.com
```

**C) Domínio não existe no banco:**
```bash
# Listar domínios
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT domain, status FROM domains WHERE deleted_at IS NULL;"

# Adicionar domínio
./scripts/create_tenant.sh novodominio.com "Nome Empresa"
```

**D) Postfix não integrado com PostgreSQL:**
```bash
# Testar query de domínios
docker exec onlitec_postfix postmap -q "seudominio.com" pgsql:/etc/postfix/pgsql/virtual_domains.cf

# Recarregar Postfix
docker exec onlitec_postfix postfix reload
```

---

### 4. Spam Não É Filtrado

#### **Sintomas:**
- Emails obviamente spam passam
- Score sempre 0 ou muito baixo
- Rspamd não integrado

#### **Diagnóstico:**
```bash
# Verificar se Rspamd está rodando
curl http://localhost:11334/ping

# Ver logs do Rspamd
docker logs --tail 50 onlitec_rspamd

# Testar integração Postfix → Rspamd
docker exec onlitec_postfix postconf smtpd_milters
```

#### **Soluções:**

**A) Rspamd não configurado no Postfix:**
```bash
# Verificar main.cf
docker exec onlitec_postfix grep milter /etc/postfix/main.cf

# Deve conter:
# smtpd_milters = inet:onlitec_rspamd:11332
# non_smtpd_milters = inet:onlitec_rspamd:11332

# Se não tiver, recriar container
docker-compose up -d --force-recreate onlitec_postfix
```

**B) Redis não conectado:**
```bash
# Testar Redis
docker exec onlitec_redis redis-cli ping

# Teste Rspamd → Redis
docker exec onlitec_rspamd redis-cli -h onlitec_redis ping
```

**C) Bayes não treinado:**
```bash
# Ver estatísticas Bayes
docker exec onlitec_rspamd rspamadm statconvert

# Treinar manualmente (exemplo spam)
cat email_spam.eml | docker exec -i onlitec_rspamd rspamc learn_spam

# Treinar ham (não-spam)
cat email_ham.eml | docker exec -i onlitec_rspamd rspamc learn_ham
```

**D) Política do tenant muito permissiva:**
```bash
# Ver política do tenant
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT * FROM spam_policies WHERE tenant_id = 'UUID_DO_TENANT';"

# Ajustar thresholds (exemplo)
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "UPDATE spam_policies 
   SET reject_score = 10.0, add_header_score = 4.0 
   WHERE tenant_id = 'UUID_DO_TENANT';"
```

---

### 5. Vírus Não É Detectado

#### **Sintomas:**
- EICAR test passa
- ClamAV não responde
- Timeout em scan

#### **Diagnóstico:**
```bash
# Verificar ClamAV status
docker exec onlitec_clamav clamdscan --ping

# Ver versão das signatures
docker exec onlitec_clamav sigtool --info /var/lib/clamav/main.cvd

# Testar 
 scan
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' | \
  docker exec -i onlitec_clamav clamdscan -
```

#### **Soluções:**

**A) Signatures desatualizadas:**
```bash
# Atualizar manualmente
docker exec onlitec_clamav freshclam

# Verificar atualização automática
docker logs onlitec_clamav | grep freshclam
```

**B) ClamAV não iniciado completamente:**
```bash
# ClamAV demora ~5 minutos para carregar signatures
# Aguardar e verificar logs
docker logs onlitec_clamav | grep "Self checking"

# Se demorar muito, aumentar memória do container
# No docker-compose.yml adicionar:
# mem_limit: 2g
```

**C) Rspamd não integrado com ClamAV:**
```bash
# Testar conexão
docker exec onlitec_rspamd nc -zv onlitec_clamav 3310

# Ver config
docker exec onlitec_rspamd cat /etc/rspamd/local.d/antivirus.conf

# Recarregar Rspamd
docker-compose restart onlitec_rspamd
```

**D) Timeout muito curto:**
```bash
# Editar rspamd/local.d/antivirus.conf
# Aumentar timeout para 30s
# Recriar container
docker-compose up -d --force-recreate onlitec_rspamd
```

---

### 6. Painel Web Não Carrega

#### **Sintomas:**
- Erro 502/504 ao acessar :9080
- "Cannot connect to database"
- Erro de autenticação

#### **Diagnóstico:**
```bash
# Verificar se está rodando
curl http://localhost:9080/health

# Ver logs
docker logs onlitec_emailprotect_panel

# Verificar conectividade com banco
docker exec onlitec_emailprotect_panel nc -zv onlitec_emailprotect_db 5432
```

#### **Soluções:**

**A) Backend não iniciado:**
```bash
# Ver logs detalhados
docker logs --tail 100 onlitec_emailprotect_panel

# Entrar no container e debugar
docker exec -it onlitec_emailprotect_panel sh
cd /app/backend
node server.js
```

**B) Falta dependências:**
```bash
# Reinstalar dependências
docker exec onlitec_emailprotect_panel sh -c "cd /app/backend && npm install"

# Recriar container
docker-compose up -d --build onlitec_emailprotect_panel
```

**C) Variáveis de ambiente incorretas:**
```bash
# Verificar .env
cat .env | grep -E '(DB_|JWT_|SESSION_)'

# Aplicar mudanças
docker-compose down
docker-compose up -d
```

---

### 7. Performance Baixa

#### **Sintomas:**
- Emails demoram para ser processados
- Timeout em operações
- Alta CPU/memória

#### **Diagnóstico:**
```bash
# Ver uso de recursos
docker stats onlitec_*

# Processos dentro do container
docker top onlitec_postfix
docker top onlitec_rspamd

# Ver filas do Postfix
docker exec onlitec_postfix postqueue -p
```

#### **Soluções:**

**A) Fila do Postfix cheia:**
```bash
# Limpar fila
docker exec onlitec_postfix postsuper -d ALL

# Forçar entrega
docker exec onlitec_postfix postqueue -f
```

**B) PostgreSQL lento:**
```bash
# Ver queries lentas
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;"

# Reindexar
docker exec onlitec_emailprotect_db psql -U emailprotect -c "REINDEX DATABASE emailprotect;"

# Vacuum
docker exec onlitec_emailprotect_db psql -U emailprotect -c "VACUUM ANALYZE;"
```

**C) Redis cheio:**
```bash
# Ver uso de memória
docker exec onlitec_redis redis-cli info memory

# Limpar dados antigos
docker exec onlitec_redis redis-cli FLUSHDB
```

**D) Aumentar recursos:**
```yaml
# No docker-compose.yml adicionar:
services:
  onlitec_rspamd:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

---

## 🛠️ Ferramentas de Debug

### Logs Centralizados

```bash
# Ver todos os logs juntos
docker-compose logs -f --tail=100

# Filtrar por erro
docker-compose logs | grep -i error

# Exportar logs
docker-compose logs > debug_$(date +%Y%m%d).log
```

### Inspeção de Containers

```bash
# Ver configuração completa
docker inspect onlitec_postfix

# Ver variáveis de ambiente
docker exec onlitec_postfix env

# Executar comando dentro do container
docker exec -it onlitec_postfix bash
```

### Monitoramento em Tempo Real

```bash
# Recursos
watch -n 1 'docker stats --no-stream onlitec_*'

# Logs
multitail -l "docker logs -f onlitec_postfix" \
          -l "docker logs -f onlitec_rspamd" \
          -l "docker logs -f onlitec_clamav"
```

---

## 📞 Suporte Avançado

### Resetar Sistema (CUIDADO!)

```bash
# Para tudo e remove (volumes permanecem)
docker-compose down

# Remove TUDO incluindo volumes
docker-compose down -v

# Limpa sistema Docker
docker system prune -a --volumes

# Reinicia do zero
docker-compose up -d
```

### Backup Antes de Debug

```bash
# Backup completo
./scripts/backup.sh

# Ou manual
docker exec onlitec_emailprotect_db pg_dump -U emailprotect > backup.sql
tar -czf config_backup.tar.gz postfix/ rspamd/ .env
```

### Contato

Para problemas não resolvidos:
1. Verificar logs: `docker-compose logs > issue.log`
2. Copiar configurações (sem senhas!)
3. Documentar passos para reproduzir
4. Abrir issue com logs anexados

---

## ✅ Checklist de Saúde

Execute periodicamente:

```bash
# 1. Teste de conectividade
./scripts/test_connectivity.sh

# 2. Verificar espaço em disco
df -h

# 3. Verificar memória
free -h

# 4. Ver estatísticas de email
docker exec onlitec_emailprotect_db psql -U emailprotect -c \
  "SELECT SUM(total_received), SUM(total_spam), SUM(total_virus) 
   FROM daily_stats 
   WHERE date = CURRENT_DATE;"

# 5. Verificar logs de erro
docker-compose logs --since 1h | grep -i error

# 6. Atualizar ClamAV
docker exec onlitec_clamav freshclam
```

---

**Última atualização:** 2024-12-24
