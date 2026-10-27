#!/usr/bin/env bash
# Trivy image scan of the Jenkins image (the only container image this pipeline builds).
# HIGH/CRITICAL findings with a fix available fail the script. Usage: ./scan-image.sh <image>
set -euo pipefail
image="${1:?usage: scan-image.sh <image>}"
trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress "$image"
