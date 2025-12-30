--[[
URL Intelligence Integration for Rspamd
Calls the URL Intelligence service for heuristic URL analysis

Symbols added:
  - URL_AI_CRITICAL (score: 12.0)
  - URL_AI_HIGH_RISK (score: 8.0)
  - URL_AI_MEDIUM_RISK (score: 4.0)
  - URL_SHORTENER (score: 2.0)
]]

local rspamd_http = require "rspamd_http"
local rspamd_logger = require "rspamd_logger"
local ucl = require "ucl"

-- Configuration
local url_intel_url = "http://onlitec_url_intel:8080/analyze/batch"
local timeout = 2.0
local enabled = true
local max_urls = 10  -- Limit URLs per email

-- Symbols
local symbol_critical = "URL_AI_CRITICAL"
local symbol_high = "URL_AI_HIGH_RISK"
local symbol_medium = "URL_AI_MEDIUM_RISK"
local symbol_shortener = "URL_SHORTENER"

local function url_callback(task)
  if not enabled then
    return
  end
  
  local urls = task:get_urls()
  if not urls or #urls == 0 then
    return
  end
  
  local url_list = {}
  for i, u in ipairs(urls) do
    if i > max_urls then
      break
    end
    table.insert(url_list, u:get_text())
  end
  
  if #url_list == 0 then
    return
  end
  
  local request_body = {
    urls = url_list,
    follow_redirects = false
  }
  
  local json_body = ucl.to_format(request_body, 'json')
  
  local function http_callback(http_err, code, body_response, headers_response)
    if http_err then
      rspamd_logger.errx(task, "URL Intelligence HTTP error: %s", http_err)
      return
    end
    
    if code ~= 200 then
      rspamd_logger.warnx(task, "URL Intelligence returned code %d", code)
      return
    end
    
    local parser = ucl.parser()
    local ok, err = parser:parse_string(body_response)
    
    if not ok then
      rspamd_logger.errx(task, "URL Intelligence JSON parse error: %s", err)
      return
    end
    
    local result = parser:get_object()
    
    if not result or not result.results then
      return
    end
    
    local max_risk = "low"
    local max_score = 0
    local risky_urls = {}
    local shortener_found = false
    
    for _, url_result in ipairs(result.results or {}) do
      local risk = url_result.risk or "low"
      local score = url_result.score or 0
      
      if score > max_score then
        max_score = score
        max_risk = risk
      end
      
      if url_result.is_shortened then
        shortener_found = true
      end
      
      if risk == "critical" or risk == "high" then
        table.insert(risky_urls, url_result.url:sub(1, 50))
      end
    end
    
    local description = table.concat(risky_urls, ", ")
    
    -- Insert symbols based on max risk level
    if max_risk == "critical" then
      task:insert_result(symbol_critical, 1.0, description)
    elseif max_risk == "high" then
      task:insert_result(symbol_high, 1.0, description)
    elseif max_risk == "medium" then
      task:insert_result(symbol_medium, 1.0, description)
    end
    
    if shortener_found then
      task:insert_result(symbol_shortener, 1.0, "URL shortener detected")
    end
    
    rspamd_logger.infox(task, "URL Intelligence: analyzed %d URLs, max_risk=%s, score=%.1f",
                        #(result.results or {}), max_risk, max_score)
  end
  
  rspamd_http.request({
    task = task,
    url = url_intel_url,
    body = json_body,
    callback = http_callback,
    timeout = timeout,
    headers = {
      ['Content-Type'] = 'application/json'
    }
  })
end

-- Register symbols
rspamd_config:register_symbol({
  name = symbol_critical,
  score = 12.0,
  description = "URL Intelligence: Critical risk URL",
  group = "url_intel",
  type = "virtual",
  parent = rspamd_config:register_symbol({
    name = "URL_INTEL_CHECK",
    type = "callback",
    callback = url_callback
  })
})

rspamd_config:register_symbol({
  name = symbol_high,
  score = 8.0,
  description = "URL Intelligence: High risk URL",
  group = "url_intel",
  type = "virtual",
  parent = rspamd_config:get_symbol_id("URL_INTEL_CHECK")
})

rspamd_config:register_symbol({
  name = symbol_medium,
  score = 4.0,
  description = "URL Intelligence: Medium risk URL",
  group = "url_intel",
  type = "virtual",
  parent = rspamd_config:get_symbol_id("URL_INTEL_CHECK")
})

rspamd_config:register_symbol({
  name = symbol_shortener,
  score = 2.0,
  description = "URL shortener detected",
  group = "url_intel",
  type = "virtual",
  parent = rspamd_config:get_symbol_id("URL_INTEL_CHECK")
})

rspamd_logger.infox(rspamd_config, "URL Intelligence module loaded")
