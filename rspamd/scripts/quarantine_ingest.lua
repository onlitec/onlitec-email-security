-- Onlitec Email Protection - Quarantine Ingestion Script
-- Captures emails with action 'quarantine' and sends them to the backend

local rspamd_http = require "rspamd_http"
local rspamd_logger = require "rspamd_logger"
local ucl = require "ucl"

-- Configuration
local ingest_url = "http://172.30.0.7:9080/api/quarantine/ingest"
local timeout = 5.0

local function quarantine_ingest_callback(task)
  local action = task:get_metric_action('default')
  
  if action ~= 'quarantine' then
    return
  end
  
  rspamd_logger.infox(task, "Quarantined email detected, sending to backend...")
  
  -- Gather metadata
  local from = task:get_from('smtp')
  local rcpts = task:get_recipients('smtp')
  local from_addr = from and from[1] and from[1].addr or "unknown"
  local to_addr = rcpts and rcpts[1] and rcpts[1].addr or "unknown"
  local subject = task:get_subject() or "(no subject)"
  local message_id = task:get_message_id() or "unknown"
  local score = task:get_metric_score('default')[1]
  
  -- Extract tenant ID from task variable set in tenant_rules.lua
  local pool = task:get_mempool()
  local tenant_id = (pool and pool:get_variable('tenant_id')) or "c3f5a2bf-d447-4729-95f9-61215bdf5275"
  
  -- Get full message content
  local content = task:get_content()
  
  -- Headers (simplify for now)
  local headers = {}
  local raw_headers = task:get_headers()
  if raw_headers then
    for k, v in pairs(raw_headers) do
        headers[k] = v
    end
  end

  local request_body = {
    tenant_id = tenant_id,
    message_id = message_id,
    from_address = from_addr,
    to_address = to_addr,
    subject = subject,
    size_bytes = #content,
    reason = 'spam',
    spam_score = score,
    body = content,
    headers = headers
  }
  
  local json_body = ucl.to_format(request_body, 'json')
  
  local function http_callback(http_err, code, body, headers)
    if http_err then
      rspamd_logger.errx(task, "Quarantine Ingest HTTP error: %s", http_err)
      return
    end
    
    if code == 201 or code == 200 then
      rspamd_logger.infox(task, "Successfully ingested email into quarantine")
    else
      rspamd_logger.errx(task, "Quarantine Ingest returned code %d: %s", code, body)
    end
  end
  
  rspamd_http.request({
    task = task,
    url = ingest_url,
    body = json_body,
    callback = http_callback,
    timeout = timeout,
    headers = {
      ['Content-Type'] = 'application/json'
    }
  })
end

-- Register as an idempotent symbol to run after all processing
rspamd_config:register_symbol({
  name = 'QUARANTINE_INGEST',
  type = 'idempotent',
  callback = quarantine_ingest_callback,
  priority = 10, -- Run later
  flags = 'empty'
})
