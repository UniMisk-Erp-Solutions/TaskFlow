// TaskFlow CI. Runs on Jenkins (ci/jenkins). Order of the whole workflow:
//   PLAN (TaskFlow task) -> CODE (feature branch) -> BUILD -> TEST -> pre-PR gate -> PR -> ADMIN MERGE -> SHIP (Vercel)
// This file covers BUILD, TEST and the pre-PR gate. It NEVER merges,
// deploys or touches production: Vercel deploys production only when an admin merges into main.
// All logic lives in ci/ (plain Node, no dependencies) so it is identical locally and in Jenkins;
// the stage names and the list of required checks come from ci/pipeline/config.mjs.
pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder(logRotator(numToKeepStr: '10', daysToKeepStr: '14'))
    skipDefaultCheckout(false)
  }

  environment {
    CI_REPO           = 'UniMisk-Erp-Solutions/TaskFlow'
    // Inert values only: CI never talks to a real backend (see CI_BUILD_ENV in ci/pipeline/config.mjs).
    NPM_CONFIG_AUDIT  = 'false'
    // Chromium's sandbox needs user namespaces, which the locked-down Jenkins container (no capabilities, default
    // seccomp) does not allow. The pages under test are our own build behind the E2E network jail.
    PLAYWRIGHT_NO_SANDBOX = '1'
    NPM_CONFIG_FUND   = 'false'
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
      // Runs even when a stage failed: it then publishes unimisk/verified = failure naming what failed.
      // On success it signs the attestation (bound to this exact commit + tree) and publishes success.
      withCredentials([
        file(credentialsId: 'taskflow-attest-private-key', variable: 'ATTEST_KEY_FILE'),
        file(credentialsId: 'taskflow-github-app-key', variable: 'GH_APP_KEY_FILE'),
        string(credentialsId: 'taskflow-github-app-id', variable: 'GITHUB_APP_ID'),
        string(credentialsId: 'taskflow-github-app-installation-id', variable: 'GITHUB_APP_INSTALLATION_ID'),
      ]) {
        sh '''
          set +x
          export CI_ATTEST_PRIVATE_KEY="$(cat "$ATTEST_KEY_FILE")"
          export GITHUB_APP_PRIVATE_KEY="$(cat "$GH_APP_KEY_FILE")"
          # Test-only knob (job parameter on taskflow-local-verify): a short-lived attestation to prove expiry.
          if [ -n "${ATTEST_TTL_SECONDS:-}" ]; then export CI_ATTEST_TTL_SECONDS="$ATTEST_TTL_SECONDS"; fi
          node ci/gate/attest.mjs || true
        '''
      }
      archiveArtifacts artifacts: '.ci/**, frontend/playwright-report/**, frontend/test-results/**', allowEmptyArchive: true
    }
    cleanup { cleanWs(deleteDirs: true, notFailBuild: true) }
  }
}
