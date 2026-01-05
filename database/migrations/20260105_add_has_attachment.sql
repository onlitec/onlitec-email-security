-- Migration: Add has_attachment column to mail_logs
-- Date: 2026-01-05
-- Description: Track emails with attachments for enhanced virus detection reporting

-- Add has_attachment column
ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on attachment-based filtering
CREATE INDEX IF NOT EXISTS idx_mail_logs_has_attachment ON mail_logs(has_attachment);

-- Comment explaining the column usage
COMMENT ON COLUMN mail_logs.has_attachment IS 'Indicates if the email contains attachments. Used for reporting blocked spam/phishing with attachments as virus detections.';
