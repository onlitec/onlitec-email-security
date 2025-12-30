#!/bin/bash
# =============================================================================
# Auto Deploy Script - Onlitec Email Security
# Este script é executado automaticamente quando há um push na branch main
# =============================================================================

set -e

# Configurações
PROJECT_DIR="/home/alfreire/docker/apps/onlitec-email"
LOG_FILE="${PROJECT_DIR}/deploy.log"
BACKUP_DIR="${PROJECT_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Função para logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para enviar notificação (opcional)
notify() {
    log "📢 $1"
}

# Início do deploy
log "=========================================="
log "🚀 INICIANDO DEPLOY AUTOMÁTICO"
log "=========================================="

cd "$PROJECT_DIR"

# 1. Criar backup do estado atual (opcional)
log "📦 Criando backup de configurações..."
mkdir -p "$BACKUP_DIR"
if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/.env.backup.$DATE"
fi

# 2. Buscar atualizações do repositório
log "📥 Buscando atualizações do Git..."
git fetch origin main

# 3. Verificar se há mudanças
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "✅ Repositório já está atualizado"
    exit 0
fi

log "📊 Commits a serem aplicados:"
git log --oneline HEAD..origin/main | while read line; do
    log "   - $line"
done

# 4. Pull das atualizações
log "⬇️  Aplicando atualizações..."
git pull origin main

# 5. Reconstruir containers
log "🔨 Reconstruindo containers..."
sudo docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE"

# 6. Reiniciar serviços (preservando volumes)
log "🔄 Reiniciando serviços..."
sudo docker compose down
sudo docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# 7. Aguardar containers ficarem healthy
log "⏳ Aguardando containers ficarem saudáveis..."
sleep 30

# 8. Verificar status
log "🔍 Verificando status dos containers..."
UNHEALTHY=$(sudo docker compose ps --format json | grep -c '"Health":"unhealthy"' || true)

if [ "$UNHEALTHY" -gt 0 ]; then
    log "⚠️  AVISO: Alguns containers não estão saudáveis"
    sudo docker compose ps 2>&1 | tee -a "$LOG_FILE"
else
    log "✅ Todos os containers estão saudáveis"
fi

# 9. Limpar imagens antigas (opcional)
log "🧹 Limpando imagens antigas não utilizadas..."
sudo docker image prune -f 2>&1 | tee -a "$LOG_FILE"

# 10. Finalização
NEW_COMMIT=$(git rev-parse --short HEAD)
log "=========================================="
log "✅ DEPLOY CONCLUÍDO COM SUCESSO"
log "📌 Versão atual: $NEW_COMMIT"
log "=========================================="

notify "Deploy do Onlitec Email Security concluído - Versão: $NEW_COMMIT"
