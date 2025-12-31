-- Onlitec Composite Risk Scoring Module
-- Combines Reputation, Behavior, Links, Attachments, Context, and AI scores.

local rspamd_logger = require "rspamd_logger"
local rspamd_redis = require "lua_redis"
local fun = require "fun"

-- Configuration
local redis_params = {
  host = os.getenv("REDIS_HOST") or "onlitec_redis",
  port = tonumber(os.getenv("REDIS_PORT")) or 6379
}

-- Weights (0.0 to 1.0)
local weights = {
  ai = 0.15,
  links = 0.25,
  attachments = 0.15,
  behavior = 0.25,  -- Domain history anomalies
  context = 0.10,   -- Sender-Recipient relationship
  reputation = 0.10 -- External RBLs / Internal Trust
}

-- Base Scores for Signals
local signals = {
  ai_phishing = 10.0,
  ai_fraud = 8.0,
  ai_spam = 5.0,
  
  link_critical = 10.0,
  link_high = 7.0,
  link_medium = 4.0,
  
  pdf_high_risk = 8.0,
  pdf_js = 5.0,
}

local function composite_callback(task)
  local score_parts = {
    ai = 0.0,
    links = 0.0,
    attachments = 0.0,
    behavior = 0.0,
    context = 0.0,
    reputation = 0.0
  }
  
  -- 1. AI Score
  if task:has_symbol("AI_PHISHING") then score_parts.ai = signals.ai_phishing
  elseif task:has_symbol("AI_FRAUD") then score_parts.ai = signals.ai_fraud
  elseif task:has_symbol("AI_SPAM") then score_parts.ai = signals.ai_spam end

  -- 2. Link Score
  if task:has_symbol("URL_AI_CRITICAL") then score_parts.links = signals.link_critical
  elseif task:has_symbol("URL_AI_HIGH_RISK") then score_parts.links = signals.link_high
  elseif task:has_symbol("URL_AI_MEDIUM_RISK") then score_parts.links = signals.link_medium end
  
  -- 3. Attachment Score
  if task:has_symbol("PDF_HIGH_RISK") then score_parts.attachments = signals.pdf_high_risk
  elseif task:has_symbol("PDF_HAS_JAVASCRIPT") then score_parts.attachments = signals.pdf_js end
  
  -- 4. Behavior & History (Fetch from Redis populated by behavior_engine)
  local from_domain = task:get_from('smtp')[1]['domain']
  if from_domain then
      local key = string.format("history:domain:%s", from_domain)
      local function redis_cb(err, data)
        if data then
             -- Simple logic: if new domain (data is small/nil) -> higher risk
             -- If "sudden change" flag set in Redis -> high risk
             -- This part relies on behavior_engine populating this key
             -- For now, we simulate a check or read a 'trust_score' field if it was a hash
             -- As a simple string in this mock: "trust:5,anom:0"
        end
      end
      -- Async Redis is tricky in sync callback flow without coroutines or specific Rspamd structure
      -- For simplicity in this implementation step, we rely on symbols inserted by behavior_engine
      if task:has_symbol("BEHAVIOR_ANOMALY") then score_parts.behavior = 10.0 end
      if task:has_symbol("BEHAVIOR_NEW_DOMAIN") then score_parts.behavior = 5.0 end
  end
  
  -- 5. Context
  if task:has_symbol("CONTEXT_STRANGER") then score_parts.context = 5.0 end
  
  -- 6. Calculate Composite Score
  local final_score = (score_parts.ai * weights.ai) +
                      (score_parts.links * weights.links) +
                      (score_parts.attachments * weights.attachments) +
                      (score_parts.behavior * weights.behavior) +
                      (score_parts.context * weights.context) +
                      (score_parts.reputation * weights.reputation)
  
  -- Normalize or Scale? 
  -- The input scores are around 0-10. Sum of weights is 1.0. 
  -- So final score is 0-10 approx. map to Rspamd 0-15 scale?
  -- 10.0 is effectively "Reject" in our weighted model if all specific components are high.
  
  -- Boost score if multiple distinct high-risk components are present (Synergy)
  if score_parts.ai > 5 and score_parts.links > 5 then
      final_score = final_score * 1.5
  end
  
  -- Apply to Task
  -- We don't overwrite the metric immediately, we add a symbol with the score
  task:insert_result("COMPOSITE_RISK", final_score, string.format(
    "ai=%.1f, link=%.1f, att=%.1f, beh=%.1f, ctx=%.1f", 
    score_parts.ai, score_parts.links, score_parts.attachments, score_parts.behavior, score_parts.context
  ))
  
  -- Add requested custom headers
  task:set_milter_reply({
    add_headers = {
        ['X-Onlitec-Risk-Score'] = string.format("%.2f", final_score),
        ['X-Onlitec-Analysis-Version'] = '2.0.0-composite'
    }
  })
  
  -- Classification based on Composite Score
  if final_score >= 8.0 then
      task:get_mempool():set_variable("risk_level", "high")
      -- Force standard symbols to ensure rejection/quarantine if needed
      task:set_metric_action("default", "add header", 6.0) -- Ensure header at least
      if final_score >= 12.0 then
         task:set_metric_action("default", "reject", 15.0)
      else
         task:set_metric_action("default", "rewrite subject", 8.0)
      end
  elseif final_score >= 4.0 then
      task:get_mempool():set_variable("risk_level", "medium")
      task:set_metric_action("default", "add header", 6.0) -- Soft warning
  else
      task:get_mempool():set_variable("risk_level", "low")
  end
  
  rspamd_logger.infox(task, "Composite Score: %.2f (Level: %s)", final_score, task:get_mempool():get_variable("risk_level") or "unknown")
end

rspamd_config:register_symbol({
  name = "COMPOSITE_SCORE_CHECK",
  type = "idempotent", -- Run after other symbols
  callback = composite_callback,
  priority = 10,
  flags = 'nice'
})

rspamd_config:register_symbol({
  name = "COMPOSITE_RISK",
  score = 0.0, -- Score is dynamic
  description = "Composite Risk Score Logic",
  type = "virtual"
})
