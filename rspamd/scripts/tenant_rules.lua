-- Onlitec Email Protection - Rspamd Multi-Tenant Logic
-- This script implements tenant-specific spam filtering rules

local rspamd_logger = require "rspamd_logger"
local rspamd_redis = require "lua_redis"
local lpeg = require "lpeg"

-- PostgreSQL connection (would need lua-pgsql or similar in production)
-- For now, we'll use Redis to cache tenant configurations

local function get_tenant_by_domain(task, domain)
  if domain == "onlitec.com.br" then
    return "c3f5a2bf-d447-4729-95f9-61215bdf5275"
  end
  return nil
end

local function get_tenant_policy(task, tenant_id)
  -- Get spam policy for tenant from Redis/PostgreSQL
  -- Returns policy object with thresholds and settings
  
  local redis_params = {
    host = os.getenv("REDIS_HOST") or "onlitec_redis",
    port = tonumber(os.getenv("REDIS_PORT")) or 6379
  }
  
  local key = string.format("tenant:policy:%s", tenant_id)
  
  -- Default policy
  local default_policy = {
    greylisting_score = 4.0,
    add_header_score = 6.0,
    rewrite_subject_score = 10.0,
    quarantine_score = 10.0,
    reject_score = 15.0,
    enable_greylisting = true,
    enable_bayes = true,
    quarantine_spam = true
  }
  
  -- TODO: Fetch from Redis/PostgreSQL
  -- For now, return default
  return default_policy
end

local function check_tenant_whitelist(task, tenant_id, from_addr, from_domain, client_ip)
  -- Check if sender is in tenant's whitelist via Redis
  
  local redis_params = {
    host = os.getenv("REDIS_HOST") or "onlitec_redis",
    port = tonumber(os.getenv("REDIS_PORT")) or 6379
  }
  
  local is_whitelisted = false
  
  -- Check email whitelist
  local email_key = string.format("tenant:%s:whitelist:email:%s", tenant_id, from_addr:lower())
  -- Check domain whitelist
  local domain_key = string.format("tenant:%s:whitelist:domain:%s", tenant_id, from_domain:lower())
  -- Check IP whitelist
  local ip_key = string.format("tenant:%s:whitelist:ip:%s", tenant_id, tostring(client_ip))
  
  local keys_to_check = { email_key, domain_key, ip_key }
  
  for _, key in ipairs(keys_to_check) do
    local ret = rspamd_redis.redis_make_request(task,
      redis_params,
      nil,
      true, -- is write = false
      function(err, data)
        if data and (data == "1" or data == 1 or (type(data) == "string" and #data > 0)) then
          is_whitelisted = true
        end
      end,
      'EXISTS',
      {key}
    )
  end
  
  return is_whitelisted
end

local function check_tenant_blacklist(task, tenant_id, from_addr, from_domain, client_ip)
  -- Check if sender is in tenant's blacklist via Redis
  -- Keys are synced from PostgreSQL by backend periodically or on insert
  
  local redis_params = {
    host = os.getenv("REDIS_HOST") or "onlitec_redis",
    port = tonumber(os.getenv("REDIS_PORT")) or 6379
  }
  
  local is_blacklisted = false
  local blacklist_reason = ""
  
  -- Check email blacklist
  local email_key = string.format("blacklist:%s:email:%s", tenant_id, from_addr:lower())
  local domain_key = string.format("blacklist:%s:domain:%s", tenant_id, from_domain:lower())
  local ip_key = string.format("blacklist:%s:ip:%s", tenant_id, tostring(client_ip))
  
  -- Also check global blacklist (no tenant prefix)
  local global_email_key = string.format("blacklist:global:email:%s", from_addr:lower())
  local global_domain_key = string.format("blacklist:global:domain:%s", from_domain:lower())
  local global_ip_key = string.format("blacklist:global:ip:%s", tostring(client_ip))
  
  local function redis_exists_cb(err, data)
    if not err and data and tonumber(data) == 1 then
      is_blacklisted = true
    end
  end
  
  -- Check all keys (async doesn't work well here, so using sync approach)
  -- In production, consider using a Lua script for atomic check
  local keys_to_check = {
    email_key, domain_key, ip_key,
    global_email_key, global_domain_key, global_ip_key
  }
  
  for _, key in ipairs(keys_to_check) do
    local ret = rspamd_redis.redis_make_request(task,
      redis_params,
      nil, -- no hash key
      true, -- is write = false
      function(err, data)
        if data and (data == "1" or data == 1 or (type(data) == "string" and #data > 0)) then
          is_blacklisted = true
          blacklist_reason = key
        end
      end,
      'EXISTS',
      {key}
    )
  end
  
  return is_blacklisted, blacklist_reason
end

local function multitenant_callback(task)
  local rcpt = task:get_recipients('smtp')
  if not rcpt or not rcpt[1] then return end
  
  local domain = rcpt[1].domain
  local tenant_id = get_tenant_by_domain(task, domain)
  if not tenant_id then return end
  
  -- Use mempool variable for internal communication
  local pool = task:get_mempool()
  if pool then
    pool:set_variable('tenant_id', tenant_id)
  end
  
  local policy = get_tenant_policy(task, tenant_id)
  local score_raw = task:get_metric_score('default')
  local score = score_raw and score_raw[1] or 0.0
  
  -- Logic: If score hits quarantine threshold but we want to avoid reject
  if policy.quarantine_spam and score >= (policy.quarantine_score or 10.0) then
    local q_score = policy.quarantine_score or 10.0
    local r_score = policy.reject_score or 15.0
    
    if score < q_score then
      -- Boost score to at least some value in quarantine range
      local boost = q_score - score + 0.1
      task:insert_result('ONLITEC_QUARANTINE', boost, 'Policy: Boosted to Quarantine')
      rspamd_logger.infox(task, "Boosted score from %s to reach quarantine threshold", tostring(score))
    elseif score >= r_score then
      -- Artificialy lower score to stay in quarantine range
      local target_score = (q_score + r_score) / 2
      
      if task.set_metric_score then
        task:set_metric_score('default', target_score)
        rspamd_logger.infox(task, "Adjusted score from %s to %s to divert rejection to quarantine", 
                            tostring(score), tostring(target_score))
        task:insert_result('ONLITEC_QUARANTINE', 0.0, 'Policy: Diverted from Reject')
      end
    else
      -- Already in quarantine range
      task:insert_result('ONLITEC_QUARANTINE', 0.0, 'Policy: Quarantine')
    end
  end
end

-- Register symbols
rspamd_config:register_symbol({
  name = 'ONLITEC_QUARANTINE',
  type = 'virtual',
  group = 'onlitec'
})

rspamd_config:set_metric_symbol({
  name = 'ONLITEC_QUARANTINE',
  score = 0.0,
  description = 'Forced by tenant rules'
})

-- Register the callback as idempotent
rspamd_config:register_symbol({
  name = 'MULTITENANT_POLICY',
  type = 'idempotent',
  callback = multitenant_callback,
  priority = 5,
  group = 'onlitec'
})

rspamd_logger.infox(rspamd_config, "Multi-tenant policy module loaded as idempotent")
