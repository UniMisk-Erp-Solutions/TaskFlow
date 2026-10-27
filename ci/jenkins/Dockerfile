# Jenkins for the TaskFlow pipeline. Everything a build needs is baked in at pinned versions with
# verified checksums, so builds never download tooling at run time.
#   docker build -t unimisk/taskflow-jenkins:2.580.1 ci/jenkins
FROM jenkins/jenkins:2.580.1-lts-jdk21

ARG NODE_VERSION=22.23.3
ARG NODE_SHA256=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
ARG TRIVY_VERSION=0.76.1
ARG TRIVY_SHA256=c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0
ARG PLAYWRIGHT_VERSION=1.64.1

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates xz-utils git \
 && rm -rf /var/lib/apt/lists/*

# Node.js (checksum-verified tarball)
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
 && rm /tmp/node.tar.xz && node --version && npm --version

# Trivy (checksum-verified release)
RUN curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" -o /tmp/trivy.tgz \
 && echo "${TRIVY_SHA256}  /tmp/trivy.tgz" | sha256sum -c - \
 && tar -xzf /tmp/trivy.tgz -C /usr/local/bin trivy && rm /tmp/trivy.tgz && trivy --version

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
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY --chown=jenkins:jenkins casc/jenkins.yaml /usr/share/jenkins/ref/casc/jenkins.yaml
