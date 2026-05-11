#!/usr/bin/env bash
# Deploy the Edge function `api` without a global Supabase CLI install.
# One-time: npx supabase@latest login
# One-time per repo: npx supabase@latest link --project-ref <your-project-ref>
# Then: ./scripts/deploy-edge-api.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx --yes supabase@latest functions deploy api "$@"
