# The gate: webhook intake, independent verification of Jenkins builds, Ed25519 signing, GitHub commit statuses.
# Build context is the repository root (see docker-compose.yml); .dockerignore keeps it to ci/.
#   The pipeline files are PINNED by git object hash at build time (ci/gate-service/pins.sh): a branch that changes the
#   Jenkinsfile or the pipeline scripts is never signed until an admin rebuilds this image from the reviewed commit.
FROM node:22.23.3-bookworm-slim

ARG DEBIAN_MIRROR=deb.debian.org
ARG GATE_PIN_JENKINSFILE
ARG GATE_PIN_CI_PIPELINE
ARG GATE_PIN_CI_LIB
ARG GATE_PIN_CI_GATE
ARG GATE_PIN_CI_VERIFY

# scan: security updates, and only the one tool we need (git, for the read-only mirror).
RUN sed -i "s|deb.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get -y upgrade \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /var/lib/gate && chown node:node /var/lib/gate

WORKDIR /app
COPY ci ./ci
ENV NODE_ENV=production \
    GATE_PIN_JENKINSFILE=${GATE_PIN_JENKINSFILE} \
    GATE_PIN_CI_PIPELINE=${GATE_PIN_CI_PIPELINE} \
    GATE_PIN_CI_LIB=${GATE_PIN_CI_LIB} \
    GATE_PIN_CI_GATE=${GATE_PIN_CI_GATE} \
    GATE_PIN_CI_VERIFY=${GATE_PIN_CI_VERIFY} \
    GATE_STATE_DIR=/var/lib/gate

USER node
EXPOSE 8089 8090
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8089/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "ci/gate-service/main.mjs"]
