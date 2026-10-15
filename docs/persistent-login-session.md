# Persistent Login Session (7 Days)


## Client

`frontend/src/supabaseClient.js` creates the client with `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` and `window.localStorage`. The default storage key is unchanged so existing sessions are preserved. The one-hour access token is renewed silently using the refresh token.

## Server

`supabase/config.toml`:

- `[auth.sessions] timebox = "168h"` and `inactivity_timeout = "168h"` (7 days).
- `refresh_token_reuse_interval` raised from 10 to 60 seconds to avoid logouts when several tabs/requests refresh together.

These apply to a local Supabase stack. For a hosted or self-hosted project set the equivalent values in the auth service settings (some options are plan dependent).

## Known reasons for sign-out

- Closing a private/InPrivate window clears local storage.
- Hosted settings shorter than 7 days override the client behavior.
