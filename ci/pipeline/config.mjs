// Single source of truth for the TaskFlow CI pipeline.
// The Jenkinsfile, the stage runner, the pre-PR gate and the tests all read this file.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RESULTS_DIR = path.join(REPO_ROOT, ".ci", "results");

/** Hosts that must NEVER be reachable from, or baked into, CI / preview builds. */
export const PRODUCTION_HOSTS = [
  "taskflow-backend.unimisk.com",
  "taskflow-api.unimisk.com",
];

/** Inert values used for every CI build and E2E run. `.invalid` can never resolve (RFC 2606). */
export const CI_BUILD_ENV = {
  VITE_API_URL: "http://127.0.0.1:4010/api",
  VITE_SUPABASE_URL: "http://127.0.0.1:4010",
  VITE_SUPABASE_ANON_KEY: "ci-anon-key-not-a-real-credential",
};

/**
 * Stage name -> how to run it. `phase` maps to the TaskFlow pipeline column
 * (BUILD / TEST). A stage is PASS only when every command exits 0.
 */
export const STAGES = {
  lint: {
    phase: "build", title: "ESLint",
    commands: [
      { cmd: "npm", args: ["--prefix", "frontend", "run", "lint"] },
      { cmd: "npm", args: ["--prefix", "backend", "run", "lint"] },
    ],
  },
  typecheck: {
    phase: "build", title: "TypeScript check",
    commands: [{ cmd: "npm", args: ["--prefix", "frontend", "run", "typecheck"] }],
  },
  build: {
    phase: "build", title: "Vite build validation",
    commands: [
      { cmd: "npm", args: ["--prefix", "frontend", "run", "build"], env: CI_BUILD_ENV },
      { cmd: "node", args: ["ci/verify/env-separation.mjs", "--dist", "frontend/dist"] },
    ],
  },
  "unit-tests": {
    phase: "test", title: "Vitest",
    commands: [{ cmd: "node", args: ["ci/pipeline/run-vitest.mjs"], env: CI_BUILD_ENV }], // some suites import the Supabase client, which requires VITE_* to be set
  },
  "backend-tests": {
    phase: "test", title: "Backend + pipeline tests",
    commands: [
      { cmd: "node", args: ["--test", "supabase/tests/github-integration.test.mjs", "ci/tests/*.test.mjs"] },
      { cmd: "node", args: ["supabase/tests/test-ai-core.mjs"] },
      { cmd: "node", args: ["ci/pipeline/check-backend-syntax.mjs"] },
    ],
  },
  e2e: {
    phase: "test", title: "Playwright E2E (isolated, mocked API)",
    commands: [{ cmd: "npm", args: ["--prefix", "frontend", "run", "e2e"], env: CI_BUILD_ENV }],
  },
  "trivy-deps": {
    phase: "test", title: "Trivy dependency scan",
    commands: [{ cmd: "node", args: ["ci/pipeline/run-trivy.mjs", "deps"] }],
  },
  "trivy-secrets": {
    phase: "test", title: "Trivy + pattern secret scan",
    commands: [
      { cmd: "node", args: ["ci/pipeline/run-trivy.mjs", "secrets"] },
      { cmd: "node", args: ["ci/pipeline/check-secrets.mjs"] },
    ],
  },
};

/** Every one of these must be PASS before an attestation is issued. */
export const REQUIRED_CHECKS = Object.keys(STAGES);

/** GitHub check-run name. Branch protection requires exactly this, bound to the Jenkins GitHub App. */
export const GITHUB_CHECK_NAME = "unimisk/verified";
