-- Onlitec Behavioral Engine
-- Tracks sender history and sender-recipient context
-- This is a simplified version using Redis directly due to lack of direct SQL access in this context without extra deps.
-- In production, this would async write to SQL via a devoted service or specialized Lua module.

local rspamd_logger = require "rspamd_logger"
local rspamd_redis = require "lua_redis"

local redis_params = {
  host = os.getenv("REDIS_HOST") or "onlitec_redis",
  port = tonumber(os.getenv("REDIS_PORT")) or 6379
}

local function behavior_callback(task)
  local from = task:get_from('smtp')
  local rcpt = task:get_recipients('smtp')
  
  if not from or not from[1] or not rcpt or not rcpt[1] then return end
  
  local sender_domain = from[1]['domain']
  local sender_email = from[1]['addr']
  local recipient_email = rcpt[1]['addr']
  
  -- 1. Check/Update Domain History
  local domain_key = "history:domain:" .. sender_domain
  
  local function history_cb(err, data)
    if err then return end
    
    -- data is map of stats: "emails", "pdfs", "first_seen"
    -- If nil, it's new
    if not data or type(data) ~= 'table' or not data['first_seen'] then
       task:insert_result("BEHAVIOR_NEW_DOMAIN", 1.0, "First time seeing this domain")
       -- Init valid data
       rspamd_redis.redis_make_request(task, redis_params, nil, false, nil, 'HSET', {domain_key, "first_seen", os.time(), "emails", "1"})
    else
       -- Check anomalies
       local email_count = tonumber(data['emails'] or 0)
       local pdf_count = tonumber(data['pdfs'] or 0)
       
       -- Check if sending PDF is anomalous (e.g. sent 100 emails, 0 PDFs, now PDF)
       -- We need to know if current email has PDF. We can check symbol PDF_ANALYZER_CHECK presence?
       -- Or just rely on task:get_parts() again?
       -- Checking parts is safer here independent of other module execution order
       local has_pdf = false
       for _, p in ipairs(task:get_parts() or {}) do
           if (p:get_filename() or ""):match("%.pdf$") then has_pdf = true break end
       end
       
       if has_pdf and email_count > 20 and pdf_count == 0 then
           task:insert_result("BEHAVIOR_ANOMALY", 1.0, "Never sent PDFs before")
       end
       
       -- Increment stats
       rspamd_redis.redis_make_request(task, redis_params, nil, false, nil, 'HINCRBY', {domain_key, "emails", "1"})
       if has_pdf then
           rspamd_redis.redis_make_request(task, redis_params, nil, false, nil, 'HINCRBY', {domain_key, "pdfs", "1"})
       end
    end
  end
  
  rspamd_redis.redis_make_request(task, redis_params, domain_key, false, history_cb, 'HGETALL', {domain_key})
  
  -- 2. Check Context (Sender <-> Recipient)
  local context_key = "context:" .. recipient_email .. ":" .. sender_email
  
  local function context_cb(err, data)
    if not data then 
       -- New relationship
       task:insert_result("CONTEXT_STRANGER", 1.0, "First interaction")
       -- Set 'seen' for next time
       rspamd_redis.redis_make_request(task, redis_params, nil, false, nil, 'SETEX', {context_key, "2592000", "1"}) -- 30 days
    else
       task:insert_result("CONTEXT_KNOWN", 1.0, "Previous interaction found")
    end
  end
  
  rspamd_redis.redis_make_request(task, redis_params, context_key, false, context_cb, 'GET', {context_key})
end

rspamd_config:register_symbol({
  name = "BEHAVIOR_CHECK",
  type = "prefilter", -- Run EARLY to populate symbols for Composite Score
  callback = behavior_callback,
  priority = 11 -- Higher priority than normal
})

rspamd_config:register_symbol({
  name = "BEHAVIOR_NEW_DOMAIN",
  score = 0.0,
  type = "virtual"
})
rspamd_config:register_symbol({
  name = "BEHAVIOR_ANOMALY",
  score = 0.0,
  type = "virtual"
})
rspamd_config:register_symbol({
  name = "CONTEXT_STRANGER",
  score = 0.0,
  type = "virtual"
})
rspamd_config:register_symbol({
  name = "CONTEXT_KNOWN",
  score = -2.0, -- Slight trust bonus?
  type = "virtual"
})
