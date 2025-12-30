--[[
PDF Analyzer Integration for Rspamd
Calls the PDF Analyzer service to detect malicious PDFs

Symbols added:
  - PDF_HAS_JAVASCRIPT (score: 10.0)
  - PDF_HAS_LINKS (score: 3.0)
  - PDF_HAS_EMBEDDED (score: 5.0)
  - PDF_HIGH_RISK (score: 8.0)
]]

local rspamd_http = require "rspamd_http"
local rspamd_logger = require "rspamd_logger"
local rspamd_util = require "rspamd_util"
local ucl = require "ucl"

-- Configuration
local pdf_analyzer_url = "http://pdf-analyzer:8080/analyze"
local timeout = 3.0  -- PDFs may take longer to process
local enabled = true

-- Symbols
local symbol_js = "PDF_HAS_JAVASCRIPT"
local symbol_links = "PDF_HAS_LINKS"
local symbol_embedded = "PDF_HAS_EMBEDDED"
local symbol_high_risk = "PDF_HIGH_RISK"

local function pdf_callback(task)
  if not enabled then
    return
  end
  
  local parts = task:get_parts()
  local pdf_found = false
  
  for _, part in ipairs(parts or {}) do
    local ct = part:get_header('Content-Type')
    local filename = part:get_filename()
    
    -- Check if it's a PDF
    local is_pdf = false
    if ct and ct:match('application/pdf') then
      is_pdf = true
    elseif filename and filename:match('%.pdf$') then
      is_pdf = true
    end
    
    if is_pdf then
      pdf_found = true
      local content = part:get_content()
      
      if content and #content > 0 then
        -- Base64 encode the PDF
        local b64_content = rspamd_util.encode_base64(content)
        
        local request_body = {
          pdf_base64 = b64_content,
          filename = filename
        }
        
        local json_body = ucl.to_format(request_body, 'json')
        
        local function http_callback(http_err, code, body_response, headers_response)
          if http_err then
            rspamd_logger.errx(task, "PDF Analyzer HTTP error: %s", http_err)
            return
          end
          
          if code ~= 200 then
            rspamd_logger.warnx(task, "PDF Analyzer returned code %d", code)
            return
          end
          
          local parser = ucl.parser()
          local ok, err = parser:parse_string(body_response)
          
          if not ok then
            rspamd_logger.errx(task, "PDF Analyzer JSON parse error: %s", err)
            return
          end
          
          local result = parser:get_object()
          
          if not result then
            return
          end
          
          local risk_score = result.risk_score or 0
          local reasons = result.reasons or {}
          local description = table.concat(reasons, "; ")
          
          -- Insert symbols based on findings
          if result.has_js then
            task:insert_result(symbol_js, 1.0, "PDF contains JavaScript")
          end
          
          if result.has_links and #(result.urls or {}) > 0 then
            task:insert_result(symbol_links, 1.0, 
                              string.format("PDF has %d URLs", #result.urls))
          end
          
          if result.has_embedded_files then
            task:insert_result(symbol_embedded, 1.0, "PDF has embedded files")
          end
          
          if risk_score >= 10 then
            task:insert_result(symbol_high_risk, 1.0, description)
          end
          
          rspamd_logger.infox(task, "PDF analyzed: risk=%.1f, js=%s, links=%d",
                              risk_score, 
                              tostring(result.has_js),
                              #(result.urls or {}))
        end
        
        rspamd_http.request({
          task = task,
          url = pdf_analyzer_url,
          body = json_body,
          callback = http_callback,
          timeout = timeout,
          headers = {
            ['Content-Type'] = 'application/json'
          }
        })
      end
    end
  end
end

-- Register symbols
-- Register parent callback symbol
rspamd_config:register_symbol({
  name = "PDF_ANALYZER_CHECK",
  type = "callback",
  callback = pdf_callback
})

-- Register virtual symbols
rspamd_config:register_symbol({
  name = symbol_js,
  score = 10.0,
  description = "PDF contains JavaScript",
  group = "pdf_analyzer",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_links,
  score = 3.0,
  description = "PDF contains external URLs",
  group = "pdf_analyzer",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_embedded,
  score = 5.0,
  description = "PDF contains embedded files",
  group = "pdf_analyzer",
  type = "virtual"
})

rspamd_config:register_symbol({
  name = symbol_high_risk,
  score = 8.0,
  description = "PDF has high risk indicators",
  group = "pdf_analyzer",
  type = "virtual"
})

rspamd_logger.infox(rspamd_config, "PDF Analyzer module loaded")
