#!/usr/bin/env bash
# Reads the inbound-agent secret of node "untrusted-1" from the RUNNING controller and writes it (mode 0400) to
# $AGENT_SECRET_PATH, the file only the agent container mounts. The secret is derived from the controller's own key,
# so it stays the same across restarts. Needs JENKINS_ADMIN_PASSWORD; nothing is printed.
set -euo pipefail
: "${JENKINS_ADMIN_PASSWORD:?set JENKINS_ADMIN_PASSWORD}" "${AGENT_SECRET_PATH:?set AGENT_SECRET_PATH}"
base="${JENKINS_LOCAL_URL:-http://127.0.0.1:8088}"
secret="$(curl -fsS -u "admin:${JENKINS_ADMIN_PASSWORD}" "${base}/computer/untrusted-1/jenkins-agent.jnlp" | grep -oE '<argument>[0-9a-f]{64}</argument>' | head -1 | sed -E 's:</?argument>::g')"
[[ -n "$secret" ]] || { echo "✘ could not read the agent secret (is node untrusted-1 defined and Jenkins up?)" >&2; exit 1; }
umask 077
tmp="${AGENT_SECRET_PATH}.tmp"
printf '%s' "$secret" > "$tmp"
chmod 0400 "$tmp"
mv -f "$tmp" "$AGENT_SECRET_PATH"
echo "✔ agent secret written to ${AGENT_SECRET_PATH} (mode 0400)"
