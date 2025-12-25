# 🌐 CONFIGURAÇÃO DNS PARA CLIENTES - Onlitec Email Protection

## 📋 VISÃO GERAL

Para que o sistema Onlitec Email Protection funcione como filtro de spam/antivírus, os clientes precisam configurar seus registros DNS para que os emails sejam recebidos primeiramente pelo nosso sistema.

---

## 🔧 INFORMAÇÕES DO SERVIDOR

### **Servidor de Email:**
- **Hostname:** `mail.onlitec.com` (ou seu domínio personalizado)
- **IP Público:** `SEU_IP_PUBLICO_AQUI`
- **Portas Abertas:**
  - **25** (SMTP - Recebimento)
  - **587** (Submission - Envio autenticado)
  - **465** (SMTPS - SSL/TLS)

---

## 📝 REGISTROS DNS NECESSÁRIOS

### **1. MX RECORD (Mail Exchange) - OBRIGATÓRIO**

Este registro direciona todos os emails do domínio do cliente para nosso servidor.

```
Tipo: MX
Nome: @ (ou domínio raiz)
Prioridade: 10
Valor: mail.onlitec.com
TTL: 3600 (1 hora)
```

**Exemplo para domínio** `acme.com`:
```
acme.com.    3600    IN    MX    10 mail.onlitec.com.
```

**Verificação:**
```bash
dig MX acme.com +short
# Deve retornar: 10 mail.onlitec.com.
```

---

### **2. SPF RECORD (Sender Policy Framework) - RECOMENDADO**

Autoriza nosso servidor a enviar emails em nome do domínio do cliente.

```
Tipo: TXT
Nome: @ (ou domínio raiz)
Valor: v=spf1 ip4:SEU_IP_PUBLICO a:mail.onlitec.com include:_spf.cliente-original.com ~all
TTL: 3600
```

**Exemplo para** `acme.com` (com IP 203.0.113.50):
```
acme.com.    3600    IN    TXT    "v=spf1 ip4:203.0.113.50 a:mail.onlitec.com include:_spf.google.com ~all"
```

**Explicação dos parâmetros:**
- `v=spf1` - Versão do SPF
- `ip4:203.0.113.50` - Autoriza nosso IP
- `a:mail.onlitec.com` - Autoriza nosso hostname
- `include:_spf.google.com` - Mantém autorizações existentes (ex: Google Workspace)
- `~all` - Soft fail (marca como suspeito mas aceita)

**Alternativa mais restritiva:**
```
v=spf1 ip4:203.0.113.50 -all
```
- `-all` - Hard fail (rejeita qualquer outro servidor)

**Verificação:**
```bash
dig TXT acme.com +short | grep spf
```

---

### **3. DMARC POLICY (Opcional mas recomendado)**

Política de autenticação de domínio.

```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com; ruf=mailto:forensics@acme.com; pct=100
TTL: 3600
```

**Exemplo para** `acme.com`:
```
_dmarc.acme.com.    3600    IN    TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@acme.com"
```

**Políticas disponíveis:**
- `p=none` - Apenas monitorar (recomendado para testes)
- `p=quarantine` - Marcar como spam (modo intermediário)
- `p=reject` - Rejeitar (modo estrito)

---

### **4. DKIM RECORD (Digital Keys to Identify Mail)**

Assinatura digital dos emails. O sistema gerará as chaves automaticamente.

```
Tipo: TXT
Nome: default._domainkey
Valor: v=DKIM1; k=rsa; p=SUA_CHAVE_PUBLICA_AQUI
TTL: 3600
```

**Nota:** A chave pública será fornecida pelo sistema após geração. Veja seção "Implementação DKIM" abaixo.

---

## 🔄 CONFIGURAÇÃO DE BACKUP/FAILOVER (Opcional)

Para redundância, configure um MX secundário:

```
Tipo: MX
Nome: @
Prioridade: 20
Valor: backup.onlitec.com
TTL: 3600
```

Emails tentarão `mail.onlitec.com` primeiro (prioridade 10), e se falhar, usarão `backup.onlitec.com` (prioridade 20).

---

## 📊 EXEMPLO COMPLETO: ZONA DNS CLIENTE

Configuração completa para domínio `acme.com`:

```dns
; MX Records
acme.com.                  3600    IN    MX     10 mail.onlitec.com.
acme.com.                  3600    IN    MX     20 backup.onlitec.com.

; A Record do nosso servidor (se hospedar em subdomínio do cliente)
mail.acme.com.             3600    IN    A      203.0.113.50

; SPF Record
acme.com.                  3600    IN    TXT    "v=spf1 ip4:203.0.113.50 a:mail.onlitec.com ~all"

; DMARC Policy
_dmarc.acme.com.           3600    IN    TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com"

; DKIM Key (será fornecida pelo sistema)
default._domainkey.acme.com.  3600  IN  TXT    "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4..."
```

---

## ⏱️ PROPAGAÇÃO DNS

Após configurar os registros:

- **TTL mínimo:** 300 segundos (5 minutos)
- **Propagação local:** 5-30 minutos
- **Propagação global:** Até 48 horas (normalmente 4-8 horas)

**Verificar propagação:**
```bash
# Consulta direta ao DNS do cliente
dig @ns1.cliente-dns.com MX acme.com

# Consulta ao Google DNS
dig @8.8.8.8 MX acme.com

# Consulta a múltiplos servidores
nslookup -type=MX acme.com 8.8.8.8
```

---

## ✅ CHECKLIST DE CONFIGURAÇÃO

Cliente deve:
- [ ] Configurar MX record apontando para `mail.onlitec.com`
- [ ] Aguardar propagação (mínimo 1 hora)
- [ ] Configurar SPF record incluindo nosso IP
- [ ] Configurar DMARC policy (iniciar com `p=none`)
- [ ] Aguardar chaves DKIM e publicar record
- [ ] Testar envio de email de teste
- [ ] Monitorar logs por 24h
- [ ] Ajustar policies conforme necessário

---

## 🧪 TESTES DE VERIFICAÇÃO

### **1. Teste de MX:**
```bash
host -t MX acme.com
# Deve retornar: acme.com mail is handled by 10 mail.onlitec.com.
```

### **2. Teste de SPF:**
```bash
host -t TXT acme.com | grep spf
# Deve incluir: ip4:203.0.113.50
```

### **3. Teste de conectividade SMTP:**
```bash
telnet mail.onlitec.com 25
# Deve conectar e mostrar: 220 mail.onlitec.local ESMTP
```

### **4. Enviar email de teste:**
```bash
swaks --to teste@acme.com \
      --from externo@exemplo.com \
      --server mail.onlitec.com \
      --port 25 \
      --header "Subject: Teste MX"
```

### **5. Ferramentas online:**
- **MX Toolbox:** https://mxtoolbox.com/supertool.aspx
- **SPF Check:** https://mxtoolbox.com/spf.aspx
- **DMARC Check:** https://dmarc.org/dmarc-validator/
- **DKIM Check:** https://mxtoolbox.com/dkim.aspx

---

## 🔐 SEGURANÇA

### **Recomendações:**

1. **Sempre use TLS/STARTTLS**
2. **Mantenha SPF atualizado**
3. **Monitore relatórios DMARC**
4. **Use políticas DMARC progressivas:**
   - Semana 1-2: `p=none` (monitorar)
   - Semana 3-4: `p=quarantine` (quarentena)
   - Semana 5+: `p=reject` (rejeitar)

---

## 📞 SUPORTE

Se o cliente tiver problemas, verificar:

1. **DNS não propaga:** Aguardar mais tempo ou limpar cache DNS
2. **Emails não chegam:** Verificar logs do Postfix
3. **SPF falha:** Revisar sintaxe do registro
4. **DKIM falha:** Verificar se chave pública está correta

**Logs do servidor:**
```bash
docker exec onlitec_postfix tail -f /var/log/mail/mail.log
```

---

**Última atualização:** 2024-12-24  
**Versão:** 1.0.0
