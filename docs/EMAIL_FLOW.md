# Fluxo de Verificação de Emails - Onlitec Email Security

## Visão Geral da Arquitetura

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                    ONLITEC EMAIL SECURITY                     │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
┌──────────┐                                                  ▼
│  EMAIL   │──────▶ ┌─────────┐     ┌─────────┐     ┌──────────────────┐
│ EXTERNO  │        │ POSTFIX │────▶│ RSPAMD  │────▶│ DECISÃO FINAL    │
└──────────┘        │  :25    │     │ :11334  │     │ Deliver/Quarantine│
                    └─────────┘     └────┬────┘     │ /Reject           │
                                         │          └──────────────────┘
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │  AI ENGINE   │    │PDF ANALYZER  │    │URL INTEL     │
            │    :8081     │    │   :8082      │    │   :8083      │
            │              │    │              │    │              │
            │ 🧠 Phishing  │    │ 📄 PDF       │    │ 🌐 URL       │
            │ 🧠 Spam      │    │ 📄 JavaScript│    │ 🌐 Lookalike │
            │ 🧠 Fraud     │    │ 📄 Links     │    │ 🌐 Encoding  │
            └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Fluxo Detalhado Passo a Passo

### 1️⃣ Email Chega no Postfix (Porta 25)

```
Remetente → MX Record → Postfix:25
```

O Postfix recebe o email e faz verificações básicas:
- ✅ Conexão SMTP válida
- ✅ Domínio existe no sistema
- ✅ Usuário existe

### 2️⃣ Postfix Envia para Rspamd (Milter)

```
Postfix → Rspamd:11334 (via milter protocol)
```

Rspamd recebe o email completo para análise:
- Headers
- Body (texto e HTML)
- Attachments (incluindo PDFs)
- URLs encontradas

### 3️⃣ Rspamd Executa Verificações Clássicas

**Verificações nativas do Rspamd:**

| Verificação | Descrição |
|-------------|-----------|
| SPF | Sender Policy Framework |
| DKIM | DomainKeys Identified Mail |
| DMARC | Domain-based Message Authentication |
| Bayes | Filtro bayesiano de spam |
| Fuzzy | Detecção de spam por hash fuzzy |
| RBL | Blacklists de IP/domínio |
| Headers | Análise de headers suspeitos |

### 4️⃣ 🆕 Rspamd Chama Serviços de IA

Os **módulos Lua** que criamos são executados em paralelo:

---

#### 4.1 AI Semantic Engine (ai_semantic.lua)

```lua
POST http://onlitec_ai_engine:8080/analyze
{
  "subject": "URGENT: Verify your account",
  "body": "Click here to verify...",
  "urls": ["https://fake-bank.xyz/login"],
  "headers": { "from": "...", "reply_to": "..." }
}
```

**O que analisa:**
- 🔍 Padrões de urgência ("urgent", "immediately", "suspended")
- 🔍 Frases de phishing ("click here", "verify your identity")
- 🔍 Impersonação de marcas (PayPal, Amazon, bancos)
- 🔍 Mismatch From/Reply-To

**Símbolos gerados:**
| Símbolo | Score | Condição |
|---------|-------|----------|
| `AI_PHISHING` | +15.0 | Confiança ≥ 70% phishing |
| `AI_FRAUD` | +12.0 | Confiança ≥ 70% fraude |
| `AI_SPAM` | +8.0 | Confiança ≥ 60% spam |
| `AI_LEGIT` | 0.0 | Email legítimo |

---

#### 4.2 PDF Analyzer (pdf_analyzer.lua)

```lua
POST http://onlitec_pdf_analyzer:8080/analyze
{
  "pdf_base64": "<base64 do PDF>",
  "filename": "invoice.pdf"
}
```

**O que analisa:**
- 🔍 JavaScript embutido no PDF
- 🔍 OpenAction (ação ao abrir)
- 🔍 URLs dentro do PDF
- 🔍 Arquivos embutidos
- 🔍 PDF criptografado

**Símbolos gerados:**
| Símbolo | Score | Condição |
|---------|-------|----------|
| `PDF_HAS_JAVASCRIPT` | +10.0 | PDF contém JS |
| `PDF_HAS_LINKS` | +3.0 | PDF tem URLs externas |
| `PDF_HAS_EMBEDDED` | +5.0 | PDF tem arquivos embutidos |
| `PDF_HIGH_RISK` | +8.0 | Score de risco ≥ 10 |

---

#### 4.3 URL Intelligence (url_intelligence.lua)

```lua
POST http://onlitec_url_intel:8080/analyze/batch
{
  "urls": ["https://g00gle.xyz/login", "https://bit.ly/abc123"],
  "follow_redirects": false
}
```

**O que analisa:**
- 🔍 IP no lugar de domínio
- 🔍 TLDs suspeitos (.xyz, .tk, .top)
- 🔍 URL shorteners (bit.ly, tinyurl)
- 🔍 Encoding excessivo
- 🔍 Lookalikes (paypa1, g00gle)
- 🔍 Entropia do domínio
- 🔍 Keywords suspeitos no path (/login, /password)

**Símbolos gerados:**
| Símbolo | Score | Condição |
|---------|-------|----------|
| `URL_AI_CRITICAL` | +12.0 | Risco crítico |
| `URL_AI_HIGH_RISK` | +8.0 | Risco alto |
| `URL_AI_MEDIUM_RISK` | +4.0 | Risco médio |
| `URL_SHORTENER` | +2.0 | URL shortener detectado |

---

### 5️⃣ Rspamd Calcula Score Final

Todos os scores são somados:

```
SCORE TOTAL = Scores Clássicos + Scores IA

Exemplo:
  SPF_FAIL           = +2.0
  DKIM_MISSING       = +1.0
  AI_PHISHING        = +15.0    ← Novo!
  URL_AI_HIGH_RISK   = +8.0     ← Novo!
  PDF_HAS_LINKS      = +3.0     ← Novo!
  ─────────────────────────────
  TOTAL              = 29.0 pontos
```

### 6️⃣ Decisão Final

| Score | Ação | Descrição |
|-------|------|-----------|
| < 5 | ✅ **Deliver** | Entregue na caixa de entrada |
| 5-15 | 🟡 **Add Header** | Marca como possível spam |
| 15-20 | 🟠 **Quarantine** | Vai para quarentena |
| > 20 | 🔴 **Reject** | Rejeita o email |

---

## Exemplo Real: Email de Phishing

### Email recebido:
```
From: security@paypa1-verify.xyz
Reply-To: support@random-domain.top
Subject: URGENT: Your account will be suspended in 24 hours
Body: Dear customer, click here immediately to verify your identity.
Attachment: invoice.pdf (contém link https://paypa1-login.xyz)
```

### Análise passo a passo:

| Etapa | Verificação | Score |
|-------|-------------|-------|
| Rspamd | SPF_SOFTFAIL | +1.5 |
| Rspamd | DMARC_POLICY_REJECT | +3.0 |
| Rspamd | MISSING_DKIM | +1.0 |
| **AI Engine** | AI_PHISHING (urgency + impersonation) | **+15.0** |
| **AI Engine** | From/Reply-To mismatch | +4.5 |
| **PDF Analyzer** | PDF_HAS_LINKS | **+3.0** |
| **URL Intel** | URL_AI_CRITICAL (PayPal lookalike) | **+12.0** |
| **URL Intel** | Suspicious TLD .xyz | +3.0 |

### Score Final: **43.0 pontos** → 🔴 **REJECT**

O email é rejeitado antes de chegar à caixa do usuário!

---

## Diagrama de Sequência

```
┌────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│ Sender │     │ Postfix │     │ Rspamd  │     │AI Engine │     │PDF Analyze│     │URL Intel │
└───┬────┘     └────┬────┘     └────┬────┘     └────┬─────┘     └─────┬─────┘     └────┬─────┘
    │               │               │               │                 │                │
    │ SMTP Email    │               │               │                 │                │
    │──────────────▶│               │               │                 │                │
    │               │ milter        │               │                 │                │
    │               │──────────────▶│               │                 │                │
    │               │               │               │                 │                │
    │               │               │──────────────▶│                 │                │
    │               │               │ POST /analyze │                 │                │
    │               │               │◀──────────────│                 │                │
    │               │               │ {label,score} │                 │                │
    │               │               │               │                 │                │
    │               │               │──────────────────────────────▶ │                │
    │               │               │ POST /analyze (PDF)            │                │
    │               │               │◀──────────────────────────────  │                │
    │               │               │ {has_js, urls, score}          │                │
    │               │               │               │                 │                │
    │               │               │─────────────────────────────────────────────────▶│
    │               │               │ POST /analyze/batch (URLs)                       │
    │               │               │◀─────────────────────────────────────────────────│
    │               │               │ {risk, score}                                    │
    │               │               │               │                 │                │
    │               │               │ Calcular      │                 │                │
    │               │               │ Score Final   │                 │                │
    │               │◀──────────────│               │                 │                │
    │               │ action=reject │               │                 │                │
    │◀──────────────│               │               │                 │                │
    │ 550 Rejected  │               │               │                 │                │
    │               │               │               │                 │                │
```

---

## Configuração dos Módulos Lua

Os módulos estão em: `rspamd/scripts/`

### Habilitar os módulos:

Adicione ao `rspamd/local.d/external_services.conf`:

```lua
-- Carrega módulos de IA
dofile("/etc/rspamd/scripts/ai_semantic.lua")
dofile("/etc/rspamd/scripts/pdf_analyzer.lua")
dofile("/etc/rspamd/scripts/url_intelligence.lua")
```

---

## Monitoramento

### No Painel Web

Acesse **http://seu-servidor:9080/services** para ver:
- Status de cada serviço de IA
- Uptime
- Versão do modelo

### Métricas Prometheus

Cada serviço expõe métricas em `/metrics`:

```bash
curl http://localhost:8081/metrics  # AI Engine
curl http://localhost:8082/metrics  # PDF Analyzer
curl http://localhost:8083/metrics  # URL Intel
```

### Logs

```bash
# Logs do Rspamd (mostra chamadas aos serviços de IA)
docker logs onlitec_rspamd

# Logs do AI Engine
docker logs onlitec_ai_engine

# Logs do PDF Analyzer
docker logs onlitec_pdf_analyzer

# Logs do URL Intel
docker logs onlitec_url_intel
```

---

## Benefícios do Novo Sistema

| Antes | Depois |
|-------|--------|
| ❌ Dependia de blacklists | ✅ Análise heurística em tempo real |
| ❌ PDFs com links passavam | ✅ Detecta JavaScript e URLs em PDFs |
| ❌ Lookalikes não detectados | ✅ Detecta g00gle.xyz, paypa1.com |
| ❌ URLs encurtadas passavam | ✅ Detecta bit.ly, tinyurl |
| ❌ Urgency scams escapavam | ✅ Detecta padrões de urgência |
| ❌ Sem explicação do bloqueio | ✅ Reasons explicam a decisão |

---

## Próximos Passos (Futuro)

1. **Treinar modelo ML real** - Substituir heurísticas por DistilBERT/RoBERTa
2. **Feedback loop** - Usuários marcam falsos positivos → retreino
3. **Sandbox de URLs** - Renderizar URLs suspeitas em headless browser
4. **Análise de imagens** - OCR para detectar phishing em imagens
