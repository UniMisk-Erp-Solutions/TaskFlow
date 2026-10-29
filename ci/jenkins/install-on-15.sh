#!/usr/bin/env bash
# Installs the TaskFlow CI stack (Jenkins controller, build agent, gate) on the shared server (192.168.23.15).
# It only ever creates things named taskflow-* / taskflow_* and never stops, restarts, removes or reconfigures
# anything that already exists. Upgrading an installed stack is done with the commands in docs/ci-cd-pipeline.md.
#
#   APPROVED_BY="<admin name>" ./ci/jenkins/install-on-15.sh            # real run
#   ./ci/jenkins/install-on-15.sh --check                               # only run the safety checks
set -euo pipefail
cd "$(dirname "$0")"

CHECK_ONLY=0; [[ "${1:-}" == "--check" ]] && CHECK_ONLY=1
fail() { echo "✘ $*" >&2; exit 1; }

# 1. Refuse to run without an explicit human approval on record.
if [[ $CHECK_ONLY -eq 0 && -z "${APPROVED_BY:-}" ]]; then fail "set APPROVED_BY to the approving admin's name (see docs/ci-cd-pipeline.md)"; fi

# 2. Required settings must already be in the environment (compose uses ':?' and fails if missing).
for v in JENKINS_ADMIN_PASSWORD JENKINS_URL GATE_GIT_SOURCE \
         GATE_JENKINS_PASSWORD_PATH DEVELOPER_PASSWORD_PATH DEV_USERS_PASSWORD_PATH GITHUB_READ_TOKEN_PATH AGENT_SECRET_PATH GATE_WEBHOOK_SECRET_PATH CI_ATTEST_PRIVATE_KEY_PATH GATE_GITHUB_TOKEN_PATH; do
  [[ -n "${!v:-}" ]] || fail "$v is not set"
done
for f in "$GATE_JENKINS_PASSWORD_PATH" "$DEVELOPER_PASSWORD_PATH" "$DEV_USERS_PASSWORD_PATH" "$GITHUB_READ_TOKEN_PATH" "$AGENT_SECRET_PATH" "$GATE_WEBHOOK_SECRET_PATH" "$CI_ATTEST_PRIVATE_KEY_PATH" "$GATE_GITHUB_TOKEN_PATH"; do
  [[ -r "$f" ]] || fail "secret file not readable: $f"
done

# 3. Capacity and collision checks (read-only).
avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
free_gb=$(df --output=avail -BG /var/lib/docker | tail -1 | tr -dc '0-9')
(( avail_mb >= 8192 )) || fail "only ${avail_mb} MB RAM available (need >= 8192)"
(( free_gb >= 50 ))   || fail "only ${free_gb} GB free in /var/lib/docker (need >= 50)"
for port in 8088 8089 8090; do
  if ss -ltn | awk '{print $4}' | grep -qE "[:.]${port}\$"; then fail "port ${port} is already in use"; fi
done
for c in taskflow-jenkins taskflow-agent taskflow-gate; do
  docker ps -a --format '{{.Names}}' | grep -qx "$c" && fail "a container named $c already exists; refusing to touch it"
done
for n in taskflow_ci taskflow_agent; do
  docker network inspect "$n" >/dev/null 2>&1 && fail "network $n already exists; refusing to reuse it"
done
echo "✔ safety checks passed (RAM ${avail_mb} MB, disk ${free_gb} GB, ports 8088/8089/8090 free, no name collisions)"
[[ $CHECK_ONLY -eq 1 ]] && exit 0

# 4. Pin the pipeline files of THIS reviewed checkout into the gate image, build, scan, then start.
#    A HIGH/CRITICAL finding in an image aborts before anything starts.
eval "$(../gate-service/pins.sh)"
export GATE_PIN_JENKINSFILE GATE_PIN_CI_PIPELINE GATE_PIN_CI_LIB GATE_PIN_CI_GATE GATE_PIN_CI_VERIFY
docker compose build
./scan-image.sh unimisk/taskflow-jenkins:2.580.1
./scan-image.sh unimisk/taskflow-gate:1
docker compose up -d jenkins
echo "waiting for Jenkins to become healthy..."
for _ in $(seq 1 40); do [[ "$(docker inspect -f '{{.State.Health.Status}}' taskflow-jenkins)" == healthy ]] && break; sleep 5; done
export JENKINS_LOCAL_URL="http://127.0.0.1:8088"
./agent-credential.sh                      # real agent secret into $AGENT_SECRET_PATH
docker compose up -d agent gate
echo "✔ CI stack started (approved by: $APPROVED_BY). Jenkins 127.0.0.1:8088, gate 127.0.0.1:8089 (webhook) / 8090 (admin)."
echo "  Next: Manage Jenkins -> Reload Configuration from Disk, then the verification steps in docs/ci-cd-pipeline.md"
