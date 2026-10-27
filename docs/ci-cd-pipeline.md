# CI/CD Pipeline

Developer automation for TaskFlow: **Jenkins** builds and tests every branch, a signed **pre-PR gate** proves an exact version of the code passed everything, an **admin** reviews and merges by hand, and **Vercel** ships production only after that merge.

```
PLAN (TaskFlow task) → CODE (feature branch) → BUILD → TEST → PRE-PR GATE
   → developer opens the PR → ADMIN reviews and merges into main → SHIP (Vercel production)
```

This is tooling around the app, not part of it. **The TaskFlow application gains no pipeline feature**: no tables, no API routes, no UI, no notifications. Nothing in this pipeline merges, deploys, or touches a production database; the frontend stays on Vercel and the backend (Supabase on `192.168.23.15`) is deployed separately by an admin (`scripts/deploy-edge-api.sh`).

> **Status:** implemented on branch `feature/ci-cd-pipeline`; **not pushed, merged or activated**. Jenkins, GitHub branch protection and the signing key are prepared and waiting for admin approval — see [Remaining setup](#remaining-setup-nothing-here-has-been-done).

## Where things live

| Piece | Location |
| --- | --- |
| Pipeline definition (Jenkins) | `Jenkinsfile` |
| Stage list, required checks, production host list, inert CI env | `ci/pipeline/config.mjs` (single source of truth) |
| Stage runner (records PASS/FAIL against the exact commit and tree) | `ci/pipeline/run-stage.mjs` |
| Vitest runner with a known-failure list | `ci/pipeline/run-vitest.mjs`, `ci/known-failures.json` |
| Trivy wrapper, secret scanner, backend syntax check | `ci/pipeline/run-trivy.mjs`, `check-secrets.mjs`, `check-backend-syntax.mjs` |
| Signed attestation (pre-PR gate) | `ci/lib/attestation.mjs`, `ci/gate/attest.mjs`, `ci/gate/pr-ready.mjs`, `ci/gate/generate-keypair.mjs` |
| GitHub check run `unimisk/verified` (published as a GitHub App) | `ci/lib/github-check.mjs` |
| Branch protection (dry run by default), proposed CODEOWNERS | `ci/github/branch-protection.mjs`, `ci/github/CODEOWNERS.proposed` |
| Preview/production separation | `ci/verify/env-separation.mjs` |
| Jenkins as code (image, plugins, JCasC, compose, install script) | `ci/jenkins/` |
| ESLint, TypeScript check | `frontend/eslint.config.js`, `backend/eslint.config.js`, `frontend/tsconfig.ci.json` |
| Playwright (isolated) | `frontend/playwright.config.js`, `frontend/e2e/` |
| Pipeline tests | `ci/tests/*.test.mjs` |

Source changes outside `ci/`, `Jenkinsfile` and test/config files: `frontend/package.json` and `backend/package.json` (+ lockfiles) gain dev dependencies and scripts (`lint`, `typecheck`, `e2e`), `frontend/vite.config.js` excludes `e2e/` from Vitest, `Card.tsx` gets a type-only fix, `AiChat.jsx`/`AiChatEsc.test.jsx` carry a stopgap that `main` has since superseded (see [Baseline findings](#baseline-findings)), and `.gitignore` ignores `.ci/` and Playwright output.

## BUILD and TEST

Every stage is `node ci/pipeline/run-stage.mjs <name>`; Jenkins and a laptop run the same commands.

| Stage | Phase | What it runs |
| --- | --- | --- |
| `lint` | BUILD | ESLint on `frontend/` and `backend/` (real-bug rules are errors; style is not enforced) |
| `typecheck` | BUILD | `tsc --noEmit` with `frontend/tsconfig.ci.json` |
| `build` | BUILD | `vite build` with inert env, then `env-separation --dist` (no production host may appear in the bundle) |
| `unit-tests` | TEST | Vitest, compared with `ci/known-failures.json` |
| `backend-tests` | TEST | `supabase/tests/` (GitHub integration, AI core), `ci/tests/*.test.mjs`, and a syntax check of every `backend/` file |
| `e2e` | TEST | Playwright against the CI build ([Safe E2E](#safe-e2e-testing)) |
| `trivy-deps` | TEST | Trivy: fixable HIGH/CRITICAL vulnerabilities in both npm lockfiles |
| `trivy-secrets` | TEST | Trivy secret scanner plus the pattern scanner (`check-secrets.mjs`, which never prints a matched value) |

The repository ships no container image (Vercel serves the static frontend; the API is an edge function), so there is no application image scan. The only image the pipeline builds is the Jenkins image, scanned by `ci/jenkins/scan-image.sh` before it starts. A missing Trivy binary **fails** its stage, so a scan that never ran cannot look clean.

## The pre-PR gate (verification bound to exact content)

A developer cannot submit the final PR for code Jenkins has not verified, and any change after verification invalidates it.

1. A push to a feature branch runs the full pipeline on that commit.
2. `ci/gate/attest.mjs` accepts only stage results recorded for **this commit and this Git tree hash** (`HEAD^{tree}`, the content hash of the whole checked-in tree). Results from other code are `STALE`, missing ones `MISSING`, and a dirty working tree also fails.
3. If every required check is `PASS` it writes an **Ed25519-signed attestation** (`.ci/attestation.json`: repo, branch, commit, tree, each check's status, issue and expiry time; **7-day lifetime**) and publishes the GitHub check **`unimisk/verified` = success**. Otherwise it publishes `failure` naming what failed. Only `success`/`failure` are ever sent, because GitHub counts `neutral`/`skipped` as passing for required checks.
4. Only the Jenkins host holds the private key; the public key (`ci/gate/attest-public-key.pem`) is committed, so anyone can verify and no one can forge.
5. **Developer, before opening the PR:** `node ci/gate/pr-ready.mjs` (optionally `--file`/`--url` for the Jenkins artifact). It prints `READY` only if the signature is valid, every required check is `PASS`, the attestation is unexpired, **its tree equals the current tree**, and nothing is uncommitted. Amending a message or rebasing to an identical tree keeps the attestation; **any code change does not**.
6. GitHub enforces the same rule where it cannot be skipped (next section).

## Admin control

`ci/github/branch-protection.mjs` prepares protection for `main`. It is a dry run unless `--apply`, `APPROVED_BY` and `GITHUB_ADMIN_TOKEN` are all given:

- **`unimisk/verified` must pass and must come from the Jenkins GitHub App** (`app_id` pinned), so no person, token or other integration can satisfy it; the branch must be up to date (`strict`);
- a pull request with **1 approving CODEOWNER (admin) review**, stale approvals dismissed on new commits, last-push approval required, conversations resolved;
- `enforce_admins: true` (admins follow the same rules), pushes to `main` restricted to the listed admins, force-push and deletion blocked;
- repository **auto-merge disabled**.

`ci/github/CODEOWNERS.proposed` must be copied to `.github/CODEOWNERS` with the real admin team first (a wrong handle leaves no valid reviewer). Jenkins never merges: the Jenkinsfile has no merge, push or deploy commands (a test enforces it), and pull requests from forks are not built because they could run a hostile Jenkinsfile with credentials. Final PR submission and merge stay manual.

## SHIP: Vercel, Preview vs Production

- Vercel's production branch must be `main`, so only an admin-authorized merge creates a **production** deployment; every other branch and PR gets a **Preview**. This is a Vercel project setting that **has not been inspected** (no access).
- Preview and Production must use different `VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `ci/verify/env-separation.mjs` checks the CI bundle for production hosts (`--dist`, part of the `build` stage), tracked config for hard-coded production hosts (`--repo`), and an export of the Vercel project's variables (`--vercel-env env.json`: no value shared between production and preview, a Preview-specific value for each, no production host in a preview value). The last one needs the export from Vercel, so it is a manual step.

## Safe E2E testing

Playwright tests (`frontend/e2e`) cannot reach production by construction:

- the app under test is the CI build served by `vite preview` on `127.0.0.1`, built with inert URLs (`http://127.0.0.1:4010`);
- a fixture answers `127.0.0.1:4010` from **synthetic data** (a fake employee, an unsigned fake JWT) and **aborts every other host**; a request to a production host is recorded and fails the test;
- `playwright.config.js` refuses to start if the base URL is not loopback (or an explicitly allow-listed staging host) or if any `VITE_`/`E2E_` variable names a production host;
- tests prove all of this (production host aborted, external host aborted, config refuses production URLs) and cover failure paths (rejected login, API outage, anonymous access to dashboards). There are no retries.

## Baseline findings

Found while introducing the gate; recorded, not hidden. Verified 2026-10-27 against the branch (based on `2c841d3`) and the then-current `origin/main` (`14d4126`).

### The two quarantined `FileExplorerDrag` tests (and `AiChatEsc`)

On `2c841d3` three Vitest tests failed: `AiChatEsc` and two `FileExplorerDrag` tests. Read-only history investigation:

- Drag-to-move (`5fa1247`) and the Esc handler existed earlier, then **`2c841d3` ("Add TaskFlow features and GitHub integration") overwrote `FileExplorer.jsx` and `AiChat.jsx` without them**, while `docs/files-drag-drop-move.md` and `docs/ai-chat-esc-close.md` (and the deployed API) still described them. So `main@2c841d3` really differed from what was documented and deployed.
- `main` has since re-landed both: `21c5a05` (drag-to-move), `e4b41dd` (Esc), `14d4126` (test mock). Applying this pipeline to `origin/main@14d4126` in a throwaway branch gave **Vitest 46/46, 0 failures, with `ci/known-failures.json` empty**, plus lint, typecheck, build and E2E passing.
- `ci/known-failures.json` and the `AiChat.jsx`/`AiChatEsc.test.jsx` edits on this branch exist only because the branch is older than that. **After rebasing onto current `main`, drop this branch's `AiChat.jsx` and `AiChatEsc.test.jsx` hunks (main's versions are the real fix) and empty `ci/known-failures.json`.** If you forget, `run-vitest.mjs` fails with "known failures that now PASS" until you do.
- Whether the *deployed* Vercel frontend contains the drag code was not checked (no Vercel access). Compare the live bundle with `main` after the rebase.

### Trivy: HIGH/CRITICAL dependency findings

`.trivyignore` is empty on purpose, so `trivy-deps` fails today. Trivy counts runtime dependencies only (it skips dev-only trees). Dry-run results (nothing was changed; a scratch copy of the lockfiles was updated with `npm audit fix --package-lock-only` and re-scanned):

| Package (installed) | Where | Findings | Fixed in | Non-breaking? |
| --- | --- | --- | --- | --- |
| axios 1.15.2 (frontend), 1.16.0 (backend) | direct | 12 / 6 HIGH | 1.18.0, 1.20.0 | yes |
| dompurify 3.1.6 | frontend, transitive | 1 HIGH | 3.4.17 | yes |
| follow-redirects 1.16.0 | both, via axios | 2 HIGH | 1.16.1 | yes |
| form-data 4.0.5 | both, via axios | 1 HIGH | 4.0.6 | yes |
| postcss 8.5.10, source-map-js 1.2.1, ws 8.20.0 | frontend, transitive | HIGH | 8.5.18, 1.2.2, 8.21.0 | yes |
| ws 8.20.0, body-parser 1.20.5, multer 2.1.1 (direct), proxy-addr 2.0.7 (**CRITICAL**) | backend | HIGH / 1 CRITICAL | 8.21.0, 1.20.9, 2.5.0, 2.0.8 | yes |
| nanoid 3.3.3 and 4.0.2 (nested copies) | frontend, transitive | 3 HIGH each | 3.3.18 / 5.1.x | **no** — pinned inside parent packages; needs an `overrides` entry or newer parents |
| lodash-es 4.17.21 | frontend, transitive | 1 HIGH | 4.18.0 | **no** — same (override) |
| vite 5.4.21 | frontend, direct (build tool) | 2 HIGH (dev-server path handling / command injection) | 6.4.4+, 7.3.7+, 8.x | **no — major**; affects the dev server, not the shipped bundle |

Result of the simulated non-breaking `npm audit fix`: **backend → clean**; **frontend → only nanoid (2 copies), lodash-es and vite remain**. `npm audit` additionally reports `vitest`/`tinypool` (critical) and other dev-only packages that Trivy deliberately skips; they never reach production.

### Other findings

- `backend/src/controllers/taskController.js` references two undefined identifiers (`employeeSeesMappedRow`, `reportedEnd`), so sub-task listing as a non-admin and moving a task to *done* throw `ReferenceError` in the legacy Express API. The production API is the edge function, which implements both. ESLint reports them as warnings for that one file only (comment in `backend/eslint.config.js`).
- `frontend/src/components/{BookingCalendar,AvailabilityPopover,use-bookings}` import modules that do not exist here and are used nowhere; `tsconfig.ci.json` excludes them.
- On Windows, a CRLF checkout (`core.autocrlf`) broke two config tests that strip comments; `ci/tests/config.test.mjs` now normalises line endings. Very long checkout paths need `git config core.longpaths true`.

## Jenkins runtime

`ci/jenkins/` builds one image (pinned Jenkins LTS, Node 22, Trivy and Playwright Chromium, tarballs checksum-verified) and runs it with `docker-compose.yml`: **no `docker.sock`, not privileged, `cap_drop: ALL`, `no-new-privileges`, 2 CPUs / 4 GB / pid limit, its own network and volume, published on `127.0.0.1:8088` only**, one executor. `ci/jenkins/install-on-15.sh` refuses to run without `APPROVED_BY`, checks RAM, disk, port and name collisions first (`--check` runs only those), only creates `taskflow-*` resources and never touches existing ones. Every `${…}` in `casc/jenkins.yaml` is required, so a missing secret stops startup. Without a webhook route the multibranch job polls GitHub every 5 minutes.

| Credential | Purpose |
| --- | --- |
| `taskflow-attest-private-key` | Ed25519 key that signs attestations (generate on the Jenkins host with `ci/gate/generate-keypair.mjs`) |
| `taskflow-github-app-id`, `-installation-id`, `-key` | GitHub App that publishes `unimisk/verified` |
| `JENKINS_ADMIN_PASSWORD`, `JENKINS_URL` | JCasC admin and URL |

No secret is stored in the repository; the secret scanner and a test enforce that.

## Remaining setup (nothing here has been done)

1. **Rebase onto current `main`** (see above), drop the duplicated `AiChat` hunks, empty `ci/known-failures.json`.
2. **Make `trivy-deps` pass:** run `npm audit fix` in `backend/` (clears everything); in `frontend/` run it too, then add `overrides` for `nanoid` (>=3.3.18 / >=5.1.x) and `lodash-es` (>=4.18.0), and either upgrade `vite` to a fixed major (6.4.4+/7.3.7+) or have an admin approve a time-boxed `.trivyignore` entry for the two vite CVEs (dev-server only). After each change run Vitest, build and E2E.
3. Install Jenkins on `192.168.23.15` (`ci/jenkins/install-on-15.sh --check`, then with `APPROVED_BY`).
4. Generate the attestation key on the Jenkins host and commit the public key as `ci/gate/attest-public-key.pem`.
5. Create the GitHub App (Checks: write) and install it on the repository.
6. Install `.github/CODEOWNERS`, then apply branch protection (`ci/github/branch-protection.mjs --apply`).
7. Confirm in Vercel: production branch is `main`, Preview has its own `VITE_*` values (`env-separation.mjs --vercel-env`).
8. Optional: a Cloudflare route so GitHub webhooks can reach Jenkins (otherwise polling).

## Verification

```bash
npm --prefix frontend ci && npm --prefix backend ci
(cd frontend && npx playwright install chromium)
export TRIVY_BIN=/path/to/trivy
for s in lint typecheck trivy-secrets build unit-tests backend-tests e2e trivy-deps; do node ci/pipeline/run-stage.mjs $s; done
node ci/gate/attest.mjs        # Jenkins only: needs CI_ATTEST_PRIVATE_KEY
node ci/gate/pr-ready.mjs      # developer: may I open the PR?
```

Results at commit `416074c` (2026-10-27, Windows, Node 24, Trivy 0.76.1, strict policy):

| Stage | Result |
| --- | --- |
| lint | PASS (warnings only) |
| typecheck | PASS |
| build (+ no production host in bundle) | PASS |
| unit-tests (Vitest) | PASS — 39 passed, 2 quarantined known failures |
| backend-tests (GitHub integration, AI core, pipeline tests, syntax of 40 backend files) | PASS |
| e2e (Playwright, 10 tests incl. isolation and failure paths) | PASS |
| trivy-secrets | PASS |
| trivy-deps | **FAIL** (real findings above) |

Gate scenarios (real runs; attestation signed with a throwaway key):

| Scenario | Result |
| --- | --- |
| Strict policy: a failing check blocks attestation | PASS — `attest` exits 1 ("Not verified: trivy-deps=FAIL"), no attestation written; `pr-ready` NOT READY |
| All checks green (Trivy findings accepted via a scratch ignore file, demo only) | PASS — attested; `pr-ready` READY |
| Uncommitted edit after verification | PASS — NOT READY ("uncommitted changes") |
| Committed code change after verification | PASS — NOT READY ("content changed: attested tree != current"); re-attesting without re-running stages refused (all results STALE) |
| Attestation older than 7 days | PASS — NOT READY ("attestation expired") |
| Attestation signed by another key / payload edited after signing | PASS — NOT READY ("signature invalid") |
| Planted secret in a tracked file | PASS — secret scan exits 1 (file:line and rule only, value never printed) |
| Production hostname inside the built bundle | PASS — `env-separation --dist` exits 1 |
| Trivy binary missing | PASS — stage fails ("Trivy not found") instead of looking clean |
| `ci_runs` table / `/ci/*` routes / pipeline UI / event reporting | none present; `git diff 2c841d3` touches no file under `supabase/` or `backend/src/` |

Not executed (**BLOCKED**): Jenkins image build/start and the Jenkinsfile on Jenkins (no Docker daemon locally; installing on the server needs approval); live `unimisk/verified` check, branch protection and CODEOWNERS (need the GitHub App and an admin token); Vercel Preview/Production variable audit and production-branch setting (no Vercel access); comparing the deployed bundle with `main`.

## Revision log

| Date | Change |
| --- | --- |
| 2026-10-27 | Jenkins pipeline, signed pre-PR gate, branch-protection preparation, Jenkins as code, safe Playwright suite. No change to the TaskFlow application's features. |
| 2026-10-27 | Final verification: gate scenarios, Trivy audit with upgrade options, root cause of the quarantined tests (main moved on), CRLF-safe config tests. |
