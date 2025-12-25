-- ==========================================
-- ADICIONAR CAMPO RELAY AOS DOMÍNIOS
-- ==========================================

-- Adicionar colunas de relay na tabela domains
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS relay_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_port INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS relay_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_use_tls BOOLEAN DEFAULT TRUE;

-- Comentários
COMMENT ON COLUMN domains.relay_host IS 'Servidor SMTP de destino (ex: mail.cliente.com)';
COMMENT ON COLUMN domains.relay_port IS 'Porta do servidor destino (25, 587, 465)';
COMMENT ON COLUMN domains.relay_username IS 'Usuário para autenticação SMTP (se necessário)';
COMMENT ON COLUMN domains.relay_password IS 'Senha para autenticação SMTP (criptografada)';
COMMENT ON COLUMN domains.relay_use_tls IS 'Usar TLS/STARTTLS para conexão';

-- Atualizar domínios de exemplo com relay (localhost para testes)
UPDATE domains 
SET relay_host = 'localhost',
    relay_port = 25,
    relay_use_tls = FALSE
WHERE domain IN ('onlitec.local', 'example.local');

-- ==========================================
-- VIEW PARA POSTFIX TRANSPORT MAPS
-- ==========================================

CREATE OR REPLACE VIEW postfix_transport_maps AS
SELECT 
    d.domain,
    CASE 
        WHEN d.relay_host IS NOT NULL THEN
            'smtp:[' || d.relay_host || ']:' || COALESCE(d.relay_port::text, '25')
        ELSE
            'local'
    END as transport
FROM domains d
WHERE d.status = 'active' AND d.deleted_at IS NULL;

COMMENT ON VIEW postfix_transport_maps IS 'Mapeamento de domínios para transporte Postfix';

-- ==========================================
-- VIEW PARA POSTFIX SASL PASSWORD
-- ==========================================

CREATE OR REPLACE VIEW postfix_sasl_password AS
SELECT 
    '[' || d.relay_host || ']:' || d.relay_port as destination,
    d.relay_username || ':' || d.relay_password as credentials
FROM domains d
WHERE d.relay_username IS NOT NULL 
  AND d.relay_password IS NOT NULL
  AND d.status = 'active' 
  AND d.deleted_at IS NULL;

COMMENT ON VIEW postfix_sasl_password IS 'Credenciais SASL para relay autenticado';

-- ==========================================
-- FUNÇÃO PARA CONFIGURAR RELAY DE DOMÍNIO
-- ==========================================

CREATE OR REPLACE FUNCTION configure_domain_relay(
    p_domain VARCHAR,
    p_relay_host VARCHAR,
    p_relay_port INTEGER DEFAULT 25,
    p_relay_username VARCHAR DEFAULT NULL,
    p_relay_password VARCHAR DEFAULT NULL,
    p_use_tls BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE domains
    SET 
        relay_host = p_relay_host,
        relay_port = p_relay_port,
        relay_username = p_relay_username,
        relay_password = p_relay_password,
        relay_use_tls = p_use_tls,
        updated_at = NOW()
    WHERE domain = p_domain AND deleted_at IS NULL;
    
    IF FOUND THEN
        v_result = jsonb_build_object(
            'success', true,
            'message', 'Relay configured for domain: ' || p_domain,
            'config', jsonb_build_object(
                'host', p_relay_host,
                'port', p_relay_port,
                'tls', p_use_tls
            )
        );
    ELSE
        v_result = jsonb_build_object(
            'success', false,
            'message', 'Domain not found: ' || p_domain
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION configure_domain_relay IS 'Configura relay/encaminhamento para um domínio específico';

-- ==========================================
-- EXEMPLO DE USO
-- ==========================================

-- Configurar relay para um domínio:
-- SELECT configure_domain_relay(
--     'meudominio.com',           -- domínio
--     'mail.meudominio.com',       -- servidor destino
--     25,                          -- porta
--     'user@meudominio.com',       -- usuário (opcional)
--     'senha123',                  -- senha (opcional)
--     TRUE                         -- usar TLS
-- );

-- Ver configurações de relay:
-- SELECT * FROM postfix_transport_maps;

-- Ver credenciais SASL:
-- SELECT * FROM postfix_sasl_password;
