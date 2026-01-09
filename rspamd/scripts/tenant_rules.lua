-- Onlitec Email Protection - Rspamd Multi-Tenant Logic
-- This script implements tenant-specific spam filtering rules

local rspamd_logger = require "rspamd_logger"
local rspamd_redis = require "lua_redis"
local lpeg = require "lpeg"

local function get_tenant_policy(task, tenant_id)
  -- Return default policy
  return {
    greylisting_score = 4.0,
    add_header_score = 6.0,
    rewrite_subject_score = 10.0,
    quarantine_score = 10.0,
    reject_score = 15.0,
    enable_greylisting = true,
    enable_bayes = true,
    quarantine_spam = true
  }
end

--[[ WHITELIST/BLACKLIST CHECK ]]--
local function whitelist_blacklist_check(task)
  local from = task:get_from('smtp')
  local rcpt = task:get_recipients('smtp')
  
  if not from or not from[1] or not rcpt or not rcpt[1] then
    -- Fallback to MIME header if SMTP from is missing
    from = task:get_from('mime')
    if not from or not from[1] then
        return 
    end
  end
  
  local from_addr = from[1].addr:lower()
  local from_domain = from[1].domain:lower()
  local recipient_domain = rcpt[1].domain
  local client_ip = task:get_from_ip()
  local client_ip_str = client_ip and tostring(client_ip) or "unknown"
  
  -- Parse redis connection parameters
  local redis_params = rspamd_parse_redis_server('redis')
  if not redis_params then
    rspamd_logger.errx(task, "Failed to parse redis config")
    return
  end
  
  -- Async Tenant ID Lookup
  local domain_key = string.format("domain:%s:tenant_id", recipient_domain)
  
  local decision_made = false
  
  local function tenant_id_cb(err, data)
    if err or not data or (type(data) == 'userdata' and tostring(data) == 'null') then
      return
    end
    
    local tenant_id = tostring(data)
    
    -- Whitelist keys
    local whitelist_keys = {
      string.format("tenant:%s:whitelist:email:%s", tenant_id, from_addr),
      string.format("tenant:%s:whitelist:domain:%s", tenant_id, from_domain),
      string.format("tenant:%s:whitelist:ip:%s", tenant_id, client_ip_str)
    }
    
    -- Blacklist keys
    local blacklist_keys = {
      string.format("blacklist:%s:email:%s", tenant_id, from_addr),
      string.format("blacklist:%s:domain:%s", tenant_id, from_domain),
      string.format("blacklist:%s:ip:%s", tenant_id, client_ip_str),
      string.format("blacklist:global:email:%s", from_addr),
      string.format("blacklist:global:domain:%s", from_domain),
      string.format("blacklist:global:ip:%s", client_ip_str)
    }
    
    local checked_wl_count = 0
    local total_wl = #whitelist_keys
    
    -- Check Whitelist Loop
    for _, key in ipairs(whitelist_keys) do
      rspamd_redis.redis_make_request(task, redis_params, key, false, function(err, data)
        checked_wl_count = checked_wl_count + 1
        if decision_made then return end
        
        if not err and (data == 1 or data == "1" or data == true) then
          rspamd_logger.infox(task, "✅ WHITELISTED sender: %s (key: %s)", from_addr, key)
          task:set_pre_result('accept', 'Whitelisted: ' .. from_addr)
          decision_made = true
          return
        end
        
        -- If all WL checked and none found, check BL
        if checked_wl_count == total_wl then
           for _, bl_key in ipairs(blacklist_keys) do
              rspamd_redis.redis_make_request(task, redis_params, bl_key, false, function(err, data)
                  if decision_made then return end
                  if not err and (data == 1 or data == "1" or data == true) then
                     rspamd_logger.infox(task, "🚫 BLACKLISTED sender: %s (key: %s)", from_addr, bl_key)
                     task:set_pre_result('reject', 'Blacklisted: ' .. from_addr)
                     decision_made = true
                  end
              end, 'EXISTS', {bl_key})
           end
        end
      end, 'EXISTS', {key})
    end
  end
  
  rspamd_redis.redis_make_request(task, redis_params, domain_key, false, tenant_id_cb, 'GET', {domain_key})
end

--[[ QUARANTINE POLICY LOGIC ]]--
local function multitenant_callback(task)
  local rcpt = task:get_recipients('smtp')
  if not rcpt or not rcpt[1] then return end
  
  local domain = rcpt[1].domain
  
  -- Parse redis connection parameters
  local redis_params = rspamd_parse_redis_server('redis')
  if not redis_params then return end
  
  local domain_key = string.format("domain:%s:tenant_id", domain)
  
  local function tenant_id_cb(err, data)
    if err or not data or (type(data) == 'userdata' and tostring(data) == 'null') then return end
    
    local tenant_id = tostring(data)
    
    local pool = task:get_mempool()
    if pool then
      pool:set_variable('tenant_id', tenant_id)
    end
    
    local policy = get_tenant_policy(task, tenant_id)
    local score_raw = task:get_metric_score('default')
    local score = score_raw and score_raw[1] or 0.0
    
    if policy.quarantine_spam and score >= (policy.quarantine_score or 10.0) then
      local q_score = policy.quarantine_score or 10.0
      local r_score = policy.reject_score or 15.0
      
      if score < q_score then
        -- Boost to quarantine
        local boost = q_score - score + 0.1
        task:insert_result('ONLITEC_QUARANTINE', boost, 'Policy: Boosted to Quarantine')
      elseif score >= r_score then
        -- Lower to quarantine (prevent reject)
        local target = (q_score + r_score) / 2
        if task.set_metric_score then
          task:set_metric_score('default', target)
          task:insert_result('ONLITEC_QUARANTINE', 0.0, 'Policy: Diverted from Reject')
        end
      else
        task:insert_result('ONLITEC_QUARANTINE', 0.0, 'Policy: Quarantine')
      end
    end
  end
  
  rspamd_redis.redis_make_request(task, redis_params, domain_key, false, tenant_id_cb, 'GET', {domain_key})
end

-- Register Symbols
rspamd_config:register_symbol({
  name = 'WHITELIST_BLACKLIST_CHECK',
  type = 'callback',
  callback = whitelist_blacklist_check,
  priority = 10,
  flags = 'empty'
})

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

rspamd_config:register_symbol({
  name = 'MULTITENANT_POLICY',
  type = 'idempotent',
  callback = multitenant_callback,
  priority = 5,
  group = 'onlitec'
})

rspamd_logger.infox(rspamd_config, "Multi-tenant policy module loaded successfully")
