// TaskFlow CI. Triggered by a push to GitHub (webhook -> gate -> Jenkins branch scan); see docs/ci-cd-pipeline.md.
//   push -> BUILD -> TEST -> (gate verifies independently, signs, publishes the commit status) -> PR review -> ADMIN merge
// This file ONLY builds and tests. It runs on the "untrusted" agent, a container with no secrets: it holds no signing key,
// no GitHub token, and cannot reach the gate. Signing and the commit status are done by the gate (ci/gate-service),
// which re-checks everything this build reports. It NEVER merges, pushes or deploys.
// Changing this file or the pipeline scripts under ci/ makes the gate refuse to sign until an admin re-pins the pipeline.
pipeline {
  agent { label 'untrusted' }

  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder(logRotator(numToKeepStr: '10', daysToKeepStr: '14'))
  }

  environment {
    CI_REPO           = 'UniMisk-Erp-Solutions/TaskFlow'
    NPM_CONFIG_AUDIT  = 'false'
    NPM_CONFIG_FUND   = 'false'
    // Chromium's sandbox needs user namespaces, which the locked-down container (no capabilities, default seccomp)
    // does not allow. The pages under test are our own build behind the E2E network jail.
    PLAYWRIGHT_NO_SANDBOX = '1'
  }

  stages {
    stage('Install') {
      steps {
        sh 'node --version && npm --version && trivy --version | head -1'
        sh 'npm --prefix frontend ci'
        sh 'npm --prefix backend ci'
      }
    }

    stage('Build') {
      parallel {
        stage('Lint')       { steps { sh 'node ci/pipeline/run-stage.mjs lint' } }
        stage('Typecheck')  { steps { sh 'node ci/pipeline/run-stage.mjs typecheck' } }
        stage('Secrets')    { steps { sh 'node ci/pipeline/run-stage.mjs trivy-secrets' } }
      }
    }

    stage('Vite build') {
      steps { sh 'node ci/pipeline/run-stage.mjs build' }
    }

    stage('Test') {
      parallel {
        stage('Vitest')         { steps { sh 'node ci/pipeline/run-stage.mjs unit-tests' } }
        stage('Backend tests')  { steps { sh 'node ci/pipeline/run-stage.mjs backend-tests' } }
        stage('Dependencies')   { steps { sh 'node ci/pipeline/run-stage.mjs trivy-deps' } }
      }
    }

    stage('E2E (isolated)') {
      steps { sh 'node ci/pipeline/run-stage.mjs e2e' }
    }
  }

  post {
    always {
      // The per-stage results (bound to this commit and tree) are the evidence the gate reads, even for a failed build.
      archiveArtifacts artifacts: '.ci/results/*.json, frontend/playwright-report/**, frontend/test-results/**', allowEmptyArchive: true
    }
    cleanup { cleanWs(deleteDirs: true, notFailBuild: true) }
  }
}
