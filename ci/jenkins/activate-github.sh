#!/usr/bin/env bash
# Switches the running TaskFlow CI stack from "record" mode to live GitHub (run on the CI host after the two token
# files hold REAL tokens). Refuses placeholders. Recreates ONLY taskflow-jenkins and taskflow-gate; nothing else is touched.
#   cd ~/taskflow-ci/repo/ci/jenkins && ../../../activate-github.sh   (or: bash ~/taskflow-ci/activate-github.sh)
set -euo pipefail
E=~/taskflow-ci/.env; S=~/taskflow-ci/secrets
for f in github-read-token gate-github-token; do
  [[ "$(wc -c < "$S/$f")" -ge 40 ]] || { echo "✘ $S/$f is still a placeholder (put the real token there, mode 0400)"; exit 1; }
done
grep -q '^GITHUB_READ_USER=.\+' "$E" || { echo "✘ GITHUB_READ_USER missing in $E"; exit 1; }
sed -i 's/^GATE_STATUS_MODE=.*/GATE_STATUS_MODE=github-status/' "$E"
grep -q '^CASC_FILES=.*github.yaml' "$E" || sed -i 's#^CASC_FILES=.*#&,/usr/share/jenkins/ref/casc/github.yaml#' "$E"
cd ~/taskflow-ci/repo/ci/jenkins && set -a && . "$E" && set +a
eval "$(../gate-service/pins.sh)"; export GATE_PIN_JENKINSFILE GATE_PIN_CI_PIPELINE GATE_PIN_CI_LIB GATE_PIN_CI_GATE GATE_PIN_CI_VERIFY
docker compose up -d --force-recreate jenkins gate
echo "✔ live GitHub mode on (gate -> github-status, github.yaml enabled)."
# Job DSL writes the GitHub job to disk but Jenkins only loads it after a reload (known gotcha): do it here.
for _ in $(seq 1 40); do [[ "$(docker inspect -f '{{.State.Health.Status}}' taskflow-jenkins)" == healthy ]] && break; sleep 5; done
J="$(mktemp)"; CR="$(curl -s -m 10 -c "$J" -u "admin:${JENKINS_ADMIN_PASSWORD}" http://127.0.0.1:8088/crumbIssuer/api/json | sed -E 's/.*"crumb":"([^"]+)".*/\1/')"
curl -s -m 20 -o /dev/null -b "$J" -u "admin:${JENKINS_ADMIN_PASSWORD}" -H "Jenkins-Crumb: ${CR}" -X POST http://127.0.0.1:8088/reload; rm -f "$J"
echo "✔ Jenkins configuration reloaded; job 'taskflow' (GitHub) is loaded."
