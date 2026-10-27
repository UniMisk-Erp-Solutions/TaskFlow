#!/usr/bin/env bash
# Trivy image scan of the Jenkins image (the only container image this pipeline builds).
# HIGH/CRITICAL findings with a fix available fail the script. Usage: ./scan-image.sh <image>
# Uses the host's Trivy if present; otherwise the Trivy baked into the image itself, fed from `docker save`
# (no docker.sock is ever mounted into a container).
set -euo pipefail
image="${1:?usage: scan-image.sh <image>}"
flags=(--exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress)
if command -v trivy >/dev/null 2>&1; then
  trivy image "${flags[@]}" "$image"
else
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  docker save -o "$tmp/image.tar" "$image"
  docker run --rm --memory 2g --cpus 2 --entrypoint trivy -v "$tmp:/scan:ro" "$image" image --input /scan/image.tar "${flags[@]}"
fi
