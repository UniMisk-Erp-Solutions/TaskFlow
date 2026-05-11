#!/usr/bin/env bash
# Restart the local Edge Runtime Docker container so it reloads
# supabase/functions/** from disk. Use when hot reload misses changes or
# after pulling new Edge code while `supabase start` is already running.
#
# Does NOT use `supabase functions deploy` (that is for hosted projects only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="$(grep -E '^[[:space:]]*project_id[[:space:]]*=' "$ROOT/supabase/config.toml" | head -1 | sed -E 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"?([^"]*)"?.*/\1/')"
CONTAINER="supabase_edge_runtime_${PROJECT_ID}"
if ! docker ps -q -f "name=^${CONTAINER}$" | grep -q .; then
  echo "No running container named ${CONTAINER}. Start the stack first: npx supabase@latest start" >&2
  exit 1
fi
echo "Restarting ${CONTAINER}..."
docker restart "${CONTAINER}"
echo "Edge Functions base URL (local): http://127.0.0.1:54321/functions/v1"
