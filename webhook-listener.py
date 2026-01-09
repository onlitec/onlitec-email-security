#!/usr/bin/env python3
"""
Webhook Listener - Onlitec Email Security
Escuta webhooks do GitHub para deploy automático
"""

import http.server
import hashlib
import hmac
import json
import subprocess
import os
from datetime import datetime

# Configuração
PORT = 9002  # Porta diferente do OnliOps (9001)
SECRET = os.environ.get('WEBHOOK_SECRET', 'onlitec-email-webhook-secret-2024')
DEPLOY_SCRIPT = '/home/alfreire/onlitec-email-security/auto-deploy.sh'
REPO_NAME = 'onlitec/onlitec-email-security'

def log(message):
    """Log com timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}", flush=True)

def verify_signature(payload, signature):
    """Verifica a assinatura do GitHub"""
    if not signature:
        return False
    
    expected = 'sha256=' + hmac.new(
        SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)

def execute_deploy():
    """Executa o script de deploy"""
    log("🚀 Executando deploy...")
    try:
        result = subprocess.Popen(
            ['bash', DEPLOY_SCRIPT],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        log(f"✅ Deploy iniciado (PID: {result.pid})")
        return True
    except Exception as e:
        log(f"❌ Erro ao executar deploy: {e}")
        return False

class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Override para usar nosso formato de log"""
        log(f"HTTP: {args[0]}")
    
    def do_GET(self):
        """Health check endpoint"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'status': 'healthy', 'service': 'onlitec-email-webhook'}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle webhook POST"""
        if self.path != '/webhook':
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
            return
        
        # Ler payload
        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)
        
        # Verificar assinatura
        signature = self.headers.get('X-Hub-Signature-256', '')
        if not verify_signature(payload, signature):
            log("❌ Assinatura inválida")
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'Unauthorized')
            return
        
        # Processar evento
        try:
            data = json.loads(payload.decode())
            event = self.headers.get('X-GitHub-Event', '')
            
            # Verificar repositório
            repo = data.get('repository', {}).get('full_name', '')
            if repo != REPO_NAME:
                log(f"⏭️  Repositório ignorado: {repo}")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Repository ignored')
                return
            
            if event == 'push':
                ref = data.get('ref', '')
                branch = ref.split('/')[-1]
                pusher = data.get('pusher', {}).get('name', 'unknown')
                commits = len(data.get('commits', []))
                
                log(f"📥 Push recebido na branch: {branch}")
                log(f"👤 Por: {pusher}")
                log(f"📝 Commits: {commits}")
                
                if branch == 'main':
                    execute_deploy()
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'Deploy started')
                else:
                    log(f"⏭️  Ignorando push em branch: {branch}")
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'Branch ignored')
            
            elif event == 'ping':
                log("🏓 Ping recebido do GitHub")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Pong')
            
            else:
                log(f"⏭️  Evento ignorado: {event}")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Event ignored')
        
        except json.JSONDecodeError:
            log("❌ Erro ao decodificar JSON")
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid JSON')
        except Exception as e:
            log(f"❌ Erro: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Internal Error')

def main():
    server = http.server.HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    
    log("=" * 50)
    log("🎧 Onlitec Email Security - Webhook Listener")
    log(f"📡 Porta: {PORT}")
    log(f"📂 Deploy script: {DEPLOY_SCRIPT}")
    log(f"🔐 Secret configurado: {'Sim' if SECRET else 'Não'}")
    log(f"🌐 URL: http://65.109.14.53:{PORT}/webhook")
    log("=" * 50)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("👋 Encerrando...")
        server.shutdown()

if __name__ == '__main__':
    main()
