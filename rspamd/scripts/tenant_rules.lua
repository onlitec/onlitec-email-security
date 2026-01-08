-- Onlitec Email Protection - Rspamd Multi-Tenant Logic
-- This script implements tenant-specific spam filtering rules

local rspamd_logger = require "rspamd_logger"
local rspamd_redis = require "lua_redis"
local lpeg = require "lpeg"

-- PostgreSQL connection (would need lua-pgsql or similar in production)
-- For now, we'll use Redis to cache tenant configurations

local function get_tenant_by_domain(task, domain)
  -- Extract tenant_id from domain via Redis cache
  -- In production, this should query PostgreSQL
  
  local redis_params = {
    host = os.getenv("REDIS_HOST") or "onlitec_redis",
    port = tonumber(os.getenv("REDIS_PORT")) or 6379
  }
  
  local function redis_cb(err, data)
    if err then
      rspamd_logger.errx(task, "Redis error: %s", err)
      return nil
    end
    return data
  end
  
  -- Try to get tenant from Redis cache
  local key = string.format("tenant:domain:%s", domain)
  local tenant_id = rspamd_redis.redis_make_request(task,
    redis_params,
    key,
    false,
    redis_cb,
    'GET',
    {key}
  )
  
  return tenant_id
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
    add_header_score = 5.0,
    rewrite_subject_score = 10.0,
    reject_score = 15.0,
    enable_greylisting = true,
    enable_bayes = true
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

-- Main callback for multi-tenant filtering
local function multitenant_callback(task)
  -- Get recipient domain
  local rcpt = task:get_recipients('smtp')
  if not rcpt or #rcpt == 0 then
    rspamd_logger.infox(task, "No recipients found")
    return
  end
  
  -- Use first recipient's domain to determine tenant
  local rcpt_domain = rcpt[1]['domain']
  rspamd_logger.infox(task, "Recipient domain: %s", rcpt_domain)
  
  -- Get tenant ID
  local tenant_id = get_tenant_by_domain(task, rcpt_domain)
  if not tenant_id then
    rspamd_logger.infox(task, "Tenant not found for domain: %s", rcpt_domain)
    -- Use default behavior
    return
  end
  
  rspamd_logger.infox(task, "Processing for tenant: %s", tenant_id)
  
  -- Get tenant's spam policy
  local policy = get_tenant_policy(task, tenant_id)
  
  -- Get sender information
  local from = task:get_from('smtp')
  local from_addr = from and from[1] and from[1]['addr'] or ''
  local from_domain = from and from[1] and from[1]['domain'] or ''
  local client_ip = task:get_from_ip()
  
  -- Check whitelist
  if check_tenant_whitelist(task, tenant_id, from_addr, from_domain, client_ip) then
    rspamd_logger.infox(task, "Sender %s is whitelisted for tenant %s", from_addr, tenant_id)
    task:set_pre_result('accept', 'Whitelisted sender')
    return
  end
  
  -- Check blacklist
  if check_tenant_blacklist(task, tenant_id, from_addr, from_domain, client_ip) then
    rspamd_logger.infox(task, "Sender %s is blacklisted for tenant %s", from_addr, tenant_id)
    task:set_pre_result('reject', 'Blacklisted sender')
    return
  end
  
  -- Store tenant_id in task for later use
  task:set_milter_reply({
    add_headers = {
      ['X-Tenant-ID'] = tenant_id
    }
  })
  
  -- Apply tenant-specific thresholds via metric actions
  local metric = task:get_metric_score('default')
  if metric then
    -- Apply custom actions based on tenant policy
    if policy.greylisting_score and policy.enable_greylisting then
      task:set_metric_action('default', 'greylist', policy.greylisting_score)
    end
    
    if policy.add_header_score then
      task:set_metric_action('default', 'add header', policy.add_header_score)
    end
    
    if policy.rewrite_subject_score then
      task:set_metric_action('default', 'rewrite subject', policy.rewrite_subject_score)
    end
    
    if policy.reject_score then
      task:set_metric_action('default', 'reject', policy.reject_score)
    end
  end
  
  rspamd_logger.infox(task, "Applied tenant policy: greylisting=%s, add_header=%s, reject=%s",
    policy.greylisting_score, policy.add_header_score, policy.reject_score)
end

-- Register the callback
rspamd_config:register_symbol({
  name = 'MULTITENANT_POLICY',
  type = 'prefilter',
  callback = multitenant_callback,
  priority = 10,
  flags = 'nice,empty'
})

rspamd_logger.infox(rspamd_config, "Multi-tenant policy module loaded")
