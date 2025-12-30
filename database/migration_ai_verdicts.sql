CREATE TABLE IF NOT EXISTS ai_verdicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mail_log_id UUID NOT NULL REFERENCES mail_logs(id) ON DELETE CASCADE,
    ai_label VARCHAR(50) NOT NULL,
    ai_confidence NUMERIC(5,4) DEFAULT 0,
    ai_score NUMERIC(5,2) DEFAULT 0,
    ai_reasons JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_verdicts_mail_log_id ON ai_verdicts(mail_log_id);
CREATE INDEX IF NOT EXISTS idx_ai_verdicts_ai_label ON ai_verdicts(ai_label);
CREATE INDEX IF NOT EXISTS idx_ai_verdicts_created_at ON ai_verdicts(created_at);
