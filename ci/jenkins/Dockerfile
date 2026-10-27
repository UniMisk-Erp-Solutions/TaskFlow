# Jenkins for the TaskFlow pipeline. Everything a build needs is baked in at pinned versions with
# verified checksums or image digests, so builds never download tooling at run time.
#   docker build -t unimisk/taskflow-jenkins:2.580.1 ci/jenkins
FROM jenkins/jenkins:2.580.1-lts-jdk21

ARG NODE_VERSION=22.23.3
ARG NODE_SHA256=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
ARG PLAYWRIGHT_VERSION=1.64.1
# Optional faster mirrors for slow networks (set in the env file, see docker-compose.yml). apt verifies the
# archive signatures and jenkins-plugin-cli verifies plugin checksums, so a mirror cannot alter the content.
ARG DEBIAN_MIRROR=deb.debian.org
ARG JENKINS_UC_DOWNLOAD=

USER root
RUN sed -i "s|deb.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates xz-utils git \
 && rm -rf /var/lib/apt/lists/*

# Node.js (checksum-verified tarball)
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
 && rm /tmp/node.tar.xz && node --version && npm --version

# Trivy, copied from the official image pinned by digest (GitHub release downloads are very slow from the target
# network; Docker Hub is not, and a digest pin is as strong as a checksum).
COPY --from=aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c /usr/local/bin/trivy /usr/local/bin/trivy
RUN trivy --version

# Playwright's Chromium + the OS libraries it needs, in a fixed location shared by all builds.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
 && chmod -R a+rX /opt/pw-browsers && rm -rf /var/lib/apt/lists/*

ENV TRIVY_BIN=/usr/local/bin/trivy \
    TRIVY_CACHE_DIR=/var/jenkins_home/trivy-cache \
    JAVA_OPTS="-Djenkins.install.runSetupWizard=false -Xms256m -Xmx768m" \
    CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc/jenkins.yaml

USER jenkins
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN if [ -z "$JENKINS_UC_DOWNLOAD" ]; then unset JENKINS_UC_DOWNLOAD; else export JENKINS_UC_DOWNLOAD; fi; \
    jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY --chown=jenkins:jenkins casc/ /usr/share/jenkins/ref/casc/
