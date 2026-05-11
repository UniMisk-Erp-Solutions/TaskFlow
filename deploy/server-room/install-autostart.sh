#!/usr/bin/env bash
# Install systemd units for Taskflow Supabase + Edge API autostart on boot.
# Run ONCE on the server-room PC:
#   export TASKFLOW_USER=yourlinuxuser
#   export TASKFLOW_ROOT=/path/to/taskflow
#   sudo -E bash deploy/server-room/install-autostart.sh
#
# Requires: docker, node/npm (npx), supabase project at TASKFLOW_ROOT

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TASKFLOW_USER="${TASKFLOW_USER:-$(logname 2>/dev/null || echo "${SUDO_USER:-$USER}")}"
TASKFLOW_ROOT="${TASKFLOW_ROOT:-$REPO_ROOT}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo -E bash $0" >&2
  exit 1
fi

if ! id "$TASKFLOW_USER" &>/dev/null; then
  echo "User not found: $TASKFLOW_USER" >&2
  exit 1
fi

if [[ ! -d "$TASKFLOW_ROOT" ]] || [[ ! -f "$TASKFLOW_ROOT/supabase/config.toml" ]]; then
  echo "TASKFLOW_ROOT must point to Taskflow repo (with supabase/config.toml): $TASKFLOW_ROOT" >&2
  exit 1
fi

HOME_DIR="$(getent passwd "$TASKFLOW_USER" | cut -d: -f6)"

tmp_unit() {
  local src="$1" dest="$2"
  sed \
    -e "s|TASKFLOW_ROOT_PLACEHOLDER|${TASKFLOW_ROOT}|g" \
    -e "s|TASKFLOW_USER_PLACEHOLDER|${TASKFLOW_USER}|g" \
    -e "s|HOME_DIR_PLACEHOLDER|${HOME_DIR}|g" \
    "$src" >"$dest"
}

echo "Installing systemd units for user=$TASKFLOW_USER root=$TASKFLOW_ROOT"

tmp_unit "${SCRIPT_DIR}/systemd/taskflow-supabase.service" /tmp/taskflow-supabase.service
tmp_unit "${SCRIPT_DIR}/systemd/taskflow-edge-api.service" /tmp/taskflow-edge-api.service

install -m 0644 /tmp/taskflow-supabase.service /etc/systemd/system/taskflow-supabase.service
install -m 0644 /tmp/taskflow-edge-api.service /etc/systemd/system/taskflow-edge-api.service
install -m 0644 "${SCRIPT_DIR}/systemd/cloudflared.service" /etc/systemd/system/cloudflared.service

rm -f /tmp/taskflow-supabase.service /tmp/taskflow-edge-api.service

systemctl daemon-reload

systemctl enable taskflow-supabase.service
systemctl enable taskflow-edge-api.service

# cloudflared: enable only if config exists (avoid failing enable on fresh machines)
if [[ -f /etc/cloudflared/config.yml ]]; then
  systemctl enable cloudflared.service || true
else
  echo "NOTE: /etc/cloudflared/config.yml missing — follow README Part A, then: sudo systemctl enable --now cloudflared.service"
fi

echo "Starting taskflow-supabase (may take a minute on first boot)..."
systemctl start taskflow-supabase.service || true
sleep 3
systemctl start taskflow-edge-api.service || true

if [[ -f /etc/cloudflared/config.yml ]]; then
  systemctl start cloudflared.service || true
fi

echo ""
echo "Done. Check status:"
echo "  systemctl status taskflow-supabase.service taskflow-edge-api.service cloudflared.service"
echo "  journalctl -u taskflow-edge-api.service -n 50 --no-pager"
