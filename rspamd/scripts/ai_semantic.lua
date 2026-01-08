--[[
AI Semantic Engine Integration for Rspamd
Calls the AI Engine service to classify emails for phishing/spam/fraud

Symbols added:
  - AI_PHISHING (score: 15.0)
  - AI_FRAUD (score: 12.0)
  - AI_SPAM (score: 8.0)
  - AI_LEGIT (score: 0.0)
]]

local rspamd_http = require "rspamd_http"
local rspamd_logger = require "rspamd_logger"
local lua_util = require "lua_util"
local ucl = require "ucl"

-- Configuration
local ai_engine_url = "http://ai-engine:8080/analyze"
local timeout = 2.0  -- seconds
local enabled = true

-- Symbols
local symbol_phishing = "AI_PHISHING"
local symbol_fraud = "AI_FRAUD"
local symbol_spam = "AI_SPAM"
local symbol_legit = "AI_LEGIT"

-- Symbol scores (can be overridden in config)
local scores = {
  phishing = 15.0,
  fraud = 12.0,
  spam = 8.0,
  legit = 0.0
}

local function extract_urls(task)
  local urls = {}
  for _, u in ipairs(task:get_urls() or {}) do
    table.insert(urls, u:get_text())
  end
  return urls
end

local function extract_headers(task)
  local from = task:get_from('smtp')
  local reply_to = task:get_header('Reply-To')
  
  return {
    from = from and from[1] and from[1].addr or nil,
    reply_to = reply_to
  }
end

local function ai_callback(task)
  if not enabled then
    return
  end
  
  local subject = task:get_subject() or ""
  local body_text = ""
  
  local text_parts = task:get_text_parts()
  if text_parts then
    for _, p in ipairs(text_parts) do
        local content = p:get_content()
        if content then
             body_text = body_text .. content
        end
    end
  end
  
  if #body_text > 10000 then
     body_text = body_text:sub(1, 10000)
  end
  
  local urls = extract_urls(task)
  local headers = extract_headers(task)
  
  local request_body = {
    subject = subject,
    body = body_text,
    urls = urls,
    headers = headers
  }
  
  local json_body = ucl.to_format(request_body, 'json')
  
  local function http_callback(http_err, code, body_response, headers_response)
    if http_err then
      rspamd_logger.errx(task, "AI Engine HTTP error: %s", http_err)
      return
    end
    
    if code ~= 200 then
      rspamd_logger.warnx(task, "AI Engine returned code %d", code)
      return
    end
    
    local parser = ucl.parser()
    local ok, err = parser:parse_string(body_response)
    
    if not ok then
      rspamd_logger.errx(task, "AI Engine JSON parse error: %s", err)
      return
    end
    
    local result = parser:get_object()
    
    if not result or not result.label then
      rspamd_logger.warnx(task, "AI Engine invalid response")
      return
    end
    
    local label = result.label
    local confidence = result.confidence or 0
    local score = result.score or 0
    local reasons = result.reasons or {}
    
    -- Build description from reasons
    local description = table.concat(reasons, "; ")
    
    -- Insert appropriate symbol based on classification (v2.0: Lowered thresholds)
    if label == "phishing" and confidence >= 0.5 then
      task:insert_result(symbol_phishing, 1.0, description)
      rspamd_logger.infox(task, "AI classified as PHISHING (conf=%.2f, score=%.1f)", 
                          confidence, score)
    elseif label == "fraud" and confidence >= 0.5 then
      task:insert_result(symbol_fraud, 1.0, description)
      rspamd_logger.infox(task, "AI classified as FRAUD (conf=%.2f, score=%.1f)", 
                          confidence, score)
    elseif label == "spam" and confidence >= 0.4 then
      task:insert_result(symbol_spam, 1.0, description)
      rspamd_logger.infox(task, "AI classified as SPAM (conf=%.2f, score=%.1f)", 
                          confidence, score)
    else
      -- Legit or low confidence
      task:insert_result(symbol_legit, 0.0, "AI: clean")
    end
  end
  
  rspamd_http.request({
    task = task,
    url = ai_engine_url,
    body = json_body,
    callback = http_callback,
    timeout = timeout,
    headers = {
      ['Content-Type'] = 'application/json'
    }
  })
end

-- Register symbols
-- Register parent callback symbol
rspamd_config:register_symbol({
  name = "AI_SEMANTIC_CHECK",
  type = "callback",
  callback = ai_callback
})

-- Register virtual symbols
rspamd_config:register_symbol({
  name = symbol_phishing,
  score = scores.phishing,
  description = "AI detected phishing content",
  group = "ai_semantic",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_fraud,
  score = scores.fraud,
  description = "AI detected fraud content",
  group = "ai_semantic",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_spam,
  score = scores.spam,
  description = "AI detected spam content",
  group = "ai_semantic",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_legit,
  score = scores.legit,
  description = "AI classified as legitimate",
  group = "ai_semantic",
  type = "virtual"
})

rspamd_logger.infox(rspamd_config, "AI Semantic Engine module loaded")
