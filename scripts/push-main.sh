#!/usr/bin/env bash
# Push main to GitHub using a Personal Access Token (HTTPS).
# Tokens must never be committed. Revoke leaked tokens immediately.
#
# Usage (one shot):
#   GITHUB_TOKEN=ghp_xxxxxxxx ./scripts/push-main.sh
#
# Supports GH_TOKEN too (many tools use this name).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "Missing token. Run:"
  echo "  GITHUB_TOKEN=<your-classic-PAT-with-repo-scope> ./scripts/push-main.sh"
  echo "Create a token: https://github.com/settings/tokens"
  exit 1
fi

unset GIT_ASKPASS VSCODE_GIT_ASKPASS_NODE VSCODE_GIT_ASKPASS_MAIN VSCODE_GIT_ASKPASS_EXTRA_ARGS 2>/dev/null || true

git remote set-url origin https://github.com/UniMisk-Erp-Solutions/TaskFlow.git
git push "https://oauth2:${TOKEN}@github.com/UniMisk-Erp-Solutions/TaskFlow.git" HEAD:main
