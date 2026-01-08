-- Onlitec Email Protection - Main Lua Entry Point
-- Load all modules in order

print("ONLITEC: Loading Lua modules...")

local scripts = {
  "/etc/rspamd/scripts/tenant_rules.lua",
  "/etc/rspamd/scripts/ai_semantic.lua",
  "/etc/rspamd/scripts/pdf_analyzer.lua",
  "/etc/rspamd/scripts/url_intelligence.lua",
  "/etc/rspamd/scripts/quarantine_ingest.lua"
}

for _, script in ipairs(scripts) do
  print("ONLITEC: Loading script: " .. script)
  local f, err = loadfile(script)
  if f then
    local ok, ret_err = pcall(f)
    if not ok then
      print("ONLITEC: Error executing " .. script .. ": " .. tostring(ret_err))
    end
  else
    print("ONLITEC: Error loading " .. script .. ": " .. tostring(err))
  end
end

print("ONLITEC: All modules loaded")
