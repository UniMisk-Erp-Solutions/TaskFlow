#!/usr/bin/env bash
# Prints the git object hashes of the pipeline files at a commit (default HEAD) as shell assignments.
# The gate image is built with these values; builds of any commit whose pipeline files hash differently are
# never signed. Run it in the repository clone, from a commit an admin has reviewed:
#   cd <repo> && eval "$(ci/gate-service/pins.sh)" && export GATE_PIN_JENKINSFILE GATE_PIN_CI_PIPELINE GATE_PIN_CI_LIB GATE_PIN_CI_GATE GATE_PIN_CI_VERIFY
set -euo pipefail
rev="${1:-HEAD}"
pin() { printf '%s=%s\n' "$1" "$(git rev-parse --verify "$rev:$2")"; }
pin GATE_PIN_JENKINSFILE Jenkinsfile
pin GATE_PIN_CI_PIPELINE ci/pipeline
pin GATE_PIN_CI_LIB ci/lib
pin GATE_PIN_CI_GATE ci/gate
pin GATE_PIN_CI_VERIFY ci/verify
