-- ================================================
-- MIGRATION 009: Fix Transport Maps View
-- PROBLEMA: A view postfix_transport_maps não existe,
-- impedindo o Postfix de determinar para onde 
-- encaminhar os emails (relay para Hostgator)
-- ================================================

-- ================================================
-- 1. CRIAR VIEW POSTFIX_TRANSPORT_MAPS
-- ================================================
-- Esta view é consultada pelo Postfix para determinar
-- o método de transporte para cada domínio

CREATE OR REPLACE VIEW postfix_transport_maps AS
SELECT 
    d.domain,
    CASE 
        WHEN d.relay_host IS NOT NULL AND d.relay_host != '' THEN
            'smtp:[' || d.relay_host || ']:' || COALESCE(d.relay_port::text, '25')
        ELSE
            'local'
    END as transport
FROM domains d
WHERE d.status = 'active' AND d.deleted_at IS NULL;

COMMENT ON VIEW postfix_transport_maps IS 'Mapeamento de domínios para transporte Postfix - determina para onde encaminhar emails';

-- ================================================
-- 2. CRIAR VIEW POSTFIX_SASL_PASSWORD
-- ================================================
-- Esta view é usada para gerar credenciais de autenticação
-- quando o relay requer autenticação SMTP

CREATE OR REPLACE VIEW postfix_sasl_password AS
SELECT 
    '[' || d.relay_host || ']:' || d.relay_port as destination,
    d.relay_username || ':' || d.relay_password as credentials
FROM domains d
WHERE d.relay_username IS NOT NULL 
  AND d.relay_password IS NOT NULL
  AND d.relay_username != ''
  AND d.relay_password != ''
  AND d.status = 'active' 
  AND d.deleted_at IS NULL;

COMMENT ON VIEW postfix_sasl_password IS 'Credenciais SASL para relay autenticado';

-- ================================================
-- 3. GARANTIR QUE COLUNAS DE RELAY EXISTEM
-- ================================================

ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS relay_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_port INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS relay_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS relay_use_tls BOOLEAN DEFAULT TRUE;

-- ================================================
-- 4. VERIFICAR CONFIGURAÇÃO
-- ================================================

DO $$
DECLARE
    domain_count INTEGER;
    transport_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO domain_count FROM domains WHERE status = 'active';
    SELECT COUNT(*) INTO transport_count FROM postfix_transport_maps;
    
    RAISE NOTICE 'Migration 009 concluída:';
    RAISE NOTICE '  - Domínios ativos: %', domain_count;
    RAISE NOTICE '  - Entradas em transport_maps: %', transport_count;
END $$;

-- ================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_domains_relay_host ON domains(relay_host) WHERE relay_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domains_status_active ON domains(status) WHERE status = 'active';
