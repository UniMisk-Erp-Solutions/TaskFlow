#!/usr/bin/env bash
# Installs the TaskFlow Jenkins on the shared server (192.168.23.15). PENDING ADMIN APPROVAL — this
# script has not been run. It only ever creates things named taskflow-* / taskflow_ci / taskflow_jenkins_home
# and never stops, restarts, removes or reconfigures anything that already exists.
#
#   APPROVED_BY="<admin name>" ./ci/jenkins/install-on-15.sh            # real run
#   ./ci/jenkins/install-on-15.sh --check                               # only run the safety checks
set -euo pipefail
cd "$(dirname "$0")"

CHECK_ONLY=0; [[ "${1:-}" == "--check" ]] && CHECK_ONLY=1
fail() { echo "✘ $*" >&2; exit 1; }

# 1. Refuse to run without an explicit human approval on record.
if [[ $CHECK_ONLY -eq 0 && -z "${APPROVED_BY:-}" ]]; then fail "set APPROVED_BY to the approving admin's name (see docs/ci-cd-pipeline.md)"; fi

# 2. Required secrets must already be in the environment (compose uses ':?' and fails if missing).
for v in JENKINS_ADMIN_PASSWORD JENKINS_URL \
         GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY_PATH CI_ATTEST_PRIVATE_KEY_PATH; do
  [[ -n "${!v:-}" ]] || fail "$v is not set"
done
[[ -r "$GITHUB_APP_PRIVATE_KEY_PATH" && -r "$CI_ATTEST_PRIVATE_KEY_PATH" ]] || fail "key files are not readable"

# 3. Capacity and collision checks (read-only).
avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
free_gb=$(df --output=avail -BG /var/lib/docker | tail -1 | tr -dc '0-9')
(( avail_mb >= 8192 )) || fail "only ${avail_mb} MB RAM available (need >= 8192)"
(( free_gb >= 50 ))   || fail "only ${free_gb} GB free in /var/lib/docker (need >= 50)"
if ss -ltn | awk '{print $4}' | grep -qE '[:.]8088$'; then fail "port 8088 is already in use"; fi
docker ps -a --format '{{.Names}}' | grep -qx taskflow-jenkins && fail "a container named taskflow-jenkins already exists; refusing to touch it"
docker network inspect taskflow_ci >/dev/null 2>&1 && fail "network taskflow_ci already exists; refusing to reuse it"
echo "✔ safety checks passed (RAM ${avail_mb} MB, disk ${free_gb} GB, port 8088 free, no name collisions)"
[[ $CHECK_ONLY -eq 1 ]] && exit 0

# 4. Build, scan, then start. A HIGH/CRITICAL finding in the image aborts before anything starts.
docker compose build
./scan-image.sh unimisk/taskflow-jenkins:2.580.1
docker compose up -d
echo "✔ Jenkins started on 127.0.0.1:8088 (approved by: $APPROVED_BY). Next: the manual verification steps in docs/ci-cd-pipeline.md"
