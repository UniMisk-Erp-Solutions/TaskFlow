#!/usr/bin/env bash
# Trivy image scan of the images this pipeline builds (Jenkins controller/agent and the gate).
# HIGH/CRITICAL findings with a fix available fail the script. Usage: ./scan-image.sh <image>
# Uses the host's Trivy if present; otherwise the Trivy baked into the Jenkins image (TRIVY_SCANNER_IMAGE), fed from
# `docker save` (no docker.sock is ever mounted into a container). Only the Jenkins image carries Trivy.
set -euo pipefail
image="${1:?usage: scan-image.sh <image>}"
scanner="${TRIVY_SCANNER_IMAGE:-unimisk/taskflow-jenkins:2.580.1}"
flags=(--exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress)
if command -v trivy >/dev/null 2>&1; then
  trivy image "${flags[@]}" "$image"
else
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  docker save -o "$tmp/image.tar" "$image"
  docker run --rm --memory 2g --cpus 2 --entrypoint trivy -v "$tmp:/scan:ro" "$scanner" image --input /scan/image.tar "${flags[@]}"
fi
