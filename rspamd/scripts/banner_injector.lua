-- Onlitec Banner Injector
-- Injects HTML warning banners for Medium risk emails (Risk score 4.0 - 8.0 typically)

local rspamd_logger = require "rspamd_logger"

local function banner_callback(task)
  -- Check if we should inject banner
  -- We use the 'risk_level' variable set by composite_score.lua
  local risk_level = task:get_mempool():get_variable("risk_level")
  
  if risk_level ~= "medium" and risk_level ~= "high" then
    return
  end
  
  -- Don't double banner
  if task:get_header("X-Onlitec-Warning") then return end
  
  -- Create Banner HTML
  local banner_html = [[
    <div style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba; margin-bottom: 10px; font-family: sans-serif;">
      <strong>⚠️ ATENÇÃO:</strong> Este e-mail foi classificado como suspeito (Risco: ]] .. risk_level:upper() .. [[).
      Tenha cuidado com links e anexos. Confirme a origem antes de realizar pagamentos.
    </div>
  ]]
  
  local banner_text = "[[ ATENÇÃO: E-mail suspeito. Tenha cuidado. ]]\n\n"
  
  -- Modify Body
  -- Rspamd's text_part interface allows modification
  local text_parts = task:get_text_parts() or {}
  
  for _, part in ipairs(text_parts) do
      if part:is_html() then
          -- Prepend HTML
          local content = part:get_content()
          if content then
             -- Try to insert after <body> if possible, else prepend
             local new_content = ""
             local body_start = content:lower():find("<body[^>]*>")
             if body_start then
                 local body_tag_end = content:find(">", body_start)
                 new_content = content:sub(1, body_tag_end) .. banner_html .. content:sub(body_tag_end + 1)
             else
                 new_content = banner_html .. content
             end
             part:set_content(new_content)
          end
      else
          -- Prepend Text
          local content = part:get_content()
          if content then
              part:set_content(banner_text .. content)
          end
      end
  end
  
  -- Add Headers
  task:set_milter_reply({
    add_headers = {
      ['X-Onlitec-Warning'] = 'This email has been modified with a safety banner',
      ['X-Onlitec-Risk-Level'] = risk_level
    }
  })
  
  rspamd_logger.infox(task, "Injected warning banner for risk level: %s", risk_level)
  
  -- NOTE: DKIM re-signing is handled by Rspamd DKIM module if configured to sign *outgoing* mail.
  -- Since we act as gateway, we should resign if we modify.
  -- Ensure 'dkim_signing' module is enabled and configured with gateway keys.
end

rspamd_config:register_symbol({
  name = "BANNER_INJECTION",
  type = "idempotent", -- Run late
  callback = banner_callback,
  priority = 5 -- Run after composite score determined risk
})
