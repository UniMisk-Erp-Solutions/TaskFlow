<#
Run this on the OTHER PC (the one running local Supabase stack).

Assumptions:
- Supabase local stack is already running there.
- This repo (or at least the supabase/functions folder) is present on that PC.
#>

# 1) Ensure function secrets exist
npx supabase functions secrets set `
  SUPABASE_URL="http://127.0.0.1:54321" `
  SUPABASE_SERVICE_ROLE_KEY="<PUT_SERVICE_ROLE_KEY_HERE>"

# 2) Serve the Edge API function on local Supabase runtime
npx supabase functions serve api --no-verify-jwt

# After this, this function is reachable from LAN at:
# http://<SUPABASE_HOST_PC_IP>:54321/functions/v1/api
