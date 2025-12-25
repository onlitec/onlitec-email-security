# Integração com Monitoramento - Onlitec Email Protection

Guia completo para integrar o sistema de email com sua stack de monitoramento existente (Prometheus, Grafana, Alertmanager).

## 📊 Visão Geral

O sistema expõe métricas nos seguintes endpoints:

- **Rspamd**: `http://onlitec_rspamd:11334/metrics`
- **Painel Web**: `http://onlitec_emailprotect_panel:9080/metrics`
- **PostgreSQL**: Via postgres_exporter (opcional)
- **Redis**: Via redis_exporter (opcional)

---

## 🔧 Configuração do Prometheus

### 1. Adicionar Jobs de Scraping

Copie o conteúdo de `monitoring/prometheus-jobs.yml` para o seu `prometheus.yml`:

```bash
# Visualizar jobs prontos
cat /home/alfreire/docker/apps/onlitec-email/monitoring/prometheus-jobs.yml

# Adicionar ao prometheus.yml existente
cat monitoring/prometheus-jobs.yml >> /home/alfreire/monitoramento/prometheus/prometheus.yml
```

Ou manualmente adicione:

```yaml
scrape_configs:
  - job_name: 'rspamd'
    static_configs:
      - targets: ['onlitec_rspamd:11334']
    scrape_interval: 30s

  - job_name: 'email-panel'
    static_configs:
      - targets: ['onlitec_emailprotect_panel:9080']
    scrape interval: 30s
```

### 2. Reiniciar Prometheus

```bash
# Se usando docker-compose
cd /home/alfreire/monitoramento
docker-compose restart prometheus

# Ou reload config
docker exec prometheus kill -HUP 1
```

### 3. Verificar Targets

Acesse Prometheus UI: `http://seu-servidor:9090/targets`

Você deve ver:
- ✅ rspamd (UP)
- ✅ email-panel (UP)

---

## 🚨 Configuração de Alertas

### 1. Adicionar Regras de Alerta

Copie as regras de `monitoring/alerts.yml`:

```bash
# Copiar alertas
cp monitoring/alerts.yml /home/alfreire/monitoramento/prometheus/alerts/email-protection.yml
```

Ou adicione ao seu arquivo de alertas existente.

### 2. Configurar Alertmanager

Edite `alertmanager.yml` para incluir rotas específicas:

```yaml
route:
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'email-alerts'
  routes:
    # Alertas críticos de email
    - match:
        severity: critical
        component: postfix|rspamd|clamav
      receiver: 'critical-email-alerts'
      continue: true

    # Alertas de vírus
    - match_re:
        alertname: Virus.*
      receiver: 'security-team'

receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'admin@onlitec.com'
        from: 'alerts@onlitec.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@onlitec.com'
        auth_password: 'your-password'

  - name: 'critical-email-alerts'
    email_configs:
      - to: 'oncall@onlitec.com'
        send_resolved: true
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK'
        channel: '#email-alerts'

  - name: 'security-team'
    email_configs:
      - to: 'security@onlitec.com'
```

### 3. Recarregar Alertmanager

```bash
docker-compose restart alertmanager
```

---

## 📈 Dashboards Grafana

### Dashboard 1: Email Protection Overview

ID Grafana: **onlitec-email-overview**

**Painéis incluídos:**
- Total de emails recebidos/enviados (24h)
- Taxa de spam detectado
- Vírus bloqueados
- Tamanho da quarentena
- Performance do Postfix (queue, delivery time)
- Status de serviços (Postfix, Rspamd, ClamAV)

**Importar:**

```bash
# Criar dashboard JSON
cat > /home/alfreire/monitoramento/grafana/dashboards/email-protection.json <<'EOF'
{
  "dashboard": {
    "title": "Onlitec Email Protection",
    "tags": ["email", "security", "multi-tenant"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Emails Processed (24h)",
        "targets": [
          {
            "expr": "sum(increase(emails_processed_total[24h]))"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Spam Rate",
        "targets": [
          {
            "expr": "rate(spam_detected_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Virus Detections",
        "targets": [
          {
            "expr": "increase(virus_detected_total[1h])"
          }
        ],
        "type": "stat",
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "value": 0, "color": "green" },
                { "value": 1, "color": "yellow" },
                { "value": 5, "color": "red" }
              ]
            }
          }
        }
      },
      {
        "title": "Quarantine Size by Tenant",
        "targets": [
          {
            "expr": "quarantine_size"
          }
        ],
        "type": "bargauge"
      },
      {
        "title": "Service Status",
        "targets": [
          {
            "expr": "up{job=~\"rspamd|email-panel|postfix|clamav\"}"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
EOF
```

### Dashboard 2: Per-Tenant Statistics

**Query examples:**

```promql
# Emails por tenant
sum by (tenant_id) (rate(emails_processed_total[1h]))

# Spam por tenant
sum by (tenant_id) (rate(spam_detected_total[1h]))

# Quarentena por tenant
quarantine_size

# Emails rejeitados por tenant
sum by (tenant_id) (rate(emails_processed_total{status="rejected"}[1h]))
```

### Dashboard 3: System Health

**Painéis:**
- CPU/Memória dos containers
- Conexões PostgreSQL
- Uso de memória Redis
- Queue do Postfix
- Taxa de processamento Rspamd
- Latência de scan ClamAV

---

## 📊 Métricas Importantes

### Rspamd Metrics

```promql
# Taxa de processamento
rate(rspamd_scanned_total[5m])

# Tempo médio de scan
rate(rspamd_scan_time_seconds_sum[5m]) / rate(rspamd_scanned_total[5m])

# Taxa de detecção de spam
rate(rspamd_spam_total[5m]) / rate(rspamd_scanned_total[5m])

# Greylisting
rate(rspamd_greylisted_total[5m])
```

### PostgreSQL Metrics

```promql
# Conexões ativas
pg_stat_activity_count

# Tamanho do banco
pg_database_size_bytes{datname="emailprotect"}

# Queries lentas
rate(pg_stat_statements_mean_time_seconds{query=~".*"}[5m])

# Locks
pg_locks_count

# Transactions per second
rate(pg_stat_database_xact_commit[1m])
```

### Redis Metrics

```promql
# Uso de memória
redis_memory_used_bytes

# Hit rate
rate(redis_keyspace_hits_total[5m]) / 
  (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))

# Comandos por segundo
rate(redis_commands_processed_total[1m])

# Conexões
redis_connected_clients
```

### Custom Application Metrics

```promql
# Total de emails processados
sum(increase(emails_processed_total[24h]))

# Taxa de spam
sum(rate(spam_detected_total[5m]))

# Taxa de vírus
sum(rate(virus_detected_total[5m]))

# Tamanho da quarentena
sum(quarantine_size)

# HTTP requests do painel
rate(http_requests_total[5m])

# Latência HTTP
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

## 🔔 Notificações

### Telegram Bot (Opcional)

```yaml
# alertmanager.yml
receivers:
  - name: 'telegram'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: YOUR_CHAT_ID
        parse_mode: 'HTML'
        message: |
          <b>{{ .GroupLabels.alertname }}</b>
          {{ range .Alerts }}
          {{ .Annotations.description }}
          {{ end }}
```

### Slack Integration

```yaml
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_WEBHOOK_URL'
        channel: '#email-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description}}{{ end }}'
```

### PagerDuty (Produção)

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}'
```

---

## 🐛 Debugging Métricas

### Verificar se métricas estão sendo expostas

```bash
# Rspamd
curl http://localhost:11334/metrics

# Painel
curl http://localhost:9080/metrics

# Deve retornar métricas no formato Prometheus
```

### Verificar se Prometheus está coletando

```bash
# Query direta no Prometheus
curl 'http://localhost:9090/api/v1/query?query=up{job="rspamd"}'

# Deve retornar valor 1 se UP
```

### Logs do Prometheus

```bash
docker logs prometheus | grep -i email
docker logs prometheus | grep -i rspamd
```

---

## 📋Checklist de Integração

- [ ] Jobs adicionados ao prometheus.yml
- [ ] Prometheus reiniciado
- [ ] Targets mostrando UP
- [ ] Alertas configurados
- [ ] Alertmanager configurado
- [ ] Dashboards Grafana importados
- [ ] Notificações testadas
- [ ] Métricas aparecendo no Grafana
- [ ] Alertas de teste disparados e recebidos

---

## 🎯 Próximos Passos

1. **Tune de Alertas**: Ajuste thresholds baseado no seu volume
2. **Dashboards Customizados**: Crie visualizações específicas por tenant
3. **Relatórios Automáticos**: Configure relatórios diários/semanais
4. **Capacity Planning**: Use métricas para planejar recursos

---

## 📞 Suporte

Para problemas com monitoramento:
1. Verificar se métricas estão expostas
2. Verificar logs do Prometheus/Grafana
3. Consultar documentação oficial do Prometheus

**Arquivos de referência:**
- `monitoring/prometheus-jobs.yml` - Jobs de scraping
- `monitoring/alerts.yml` - Regras de alerta
- `docs/TROUBLESHOOTING.md` - Resolução de problemas
