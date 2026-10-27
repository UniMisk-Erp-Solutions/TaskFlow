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
| Vitest runner (with an optional, currently empty, known-failure list) | `ci/pipeline/run-vitest.mjs`, `ci/known-failures.json` |
| Trivy wrapper, secret scanner, backend syntax check | `ci/pipeline/run-trivy.mjs`, `scan-credentials.mjs`, `check-backend-syntax.mjs` |
| Signed attestation (pre-PR gate) | `ci/lib/attestation.mjs`, `ci/gate/attest.mjs`, `ci/gate/pr-ready.mjs`, `ci/gate/generate-keypair.mjs` |
| GitHub check run `unimisk/verified` (published as a GitHub App) | `ci/lib/github-check.mjs` |
| Branch protection (dry run by default), proposed CODEOWNERS | `ci/github/branch-protection.mjs`, `ci/github/CODEOWNERS.proposed` |
| Preview/production separation | `ci/verify/env-separation.mjs` |
| Jenkins as code (image, plugins, JCasC, compose, install script) | `ci/jenkins/` |
| ESLint, TypeScript check | `frontend/eslint.config.js`, `backend/eslint.config.js`, `frontend/tsconfig.ci.json` |
| Playwright (isolated) | `frontend/playwright.config.js`, `frontend/e2e/` |
| Pipeline tests | `ci/tests/*.test.mjs` |

Changes outside `ci/`, `Jenkinsfile` and test/config files are deliberately small: `frontend/package.json` and `backend/package.json` (+ lockfiles) gain dev dependencies, scripts (`lint`, `typecheck`, `e2e`) and, for the frontend, `overrides` and the Vite 6 upgrade (see [Dependencies](#dependencies-changed-to-clear-trivy)); `frontend/vite.config.js` excludes `e2e/` from Vitest; `Card.tsx` gets a type-only fix; `.gitignore` ignores `.ci/` and Playwright output. No application feature, API route, migration or screen was added or changed.

## BUILD and TEST

Every stage is `node ci/pipeline/run-stage.mjs <name>`; Jenkins and a laptop run the same commands.

| Stage | Phase | What it runs |
| --- | --- | --- |
| `lint` | BUILD | ESLint on `frontend/` and `backend/` (real-bug rules are errors; style is not enforced) |
| `typecheck` | BUILD | `tsc --noEmit` with `frontend/tsconfig.ci.json` |
| `build` | BUILD | `vite build` with inert env, then `env-separation --dist` (no production host may appear in the bundle) |
| `unit-tests` | TEST | Vitest; any failure fails the stage (`ci/known-failures.json` is empty) |
| `backend-tests` | TEST | `supabase/tests/` (GitHub integration, AI core), `ci/tests/*.test.mjs`, and a syntax check of every `backend/` file |
| `e2e` | TEST | Playwright against the CI build ([Safe E2E](#safe-e2e-testing)) |
| `trivy-deps` | TEST | Trivy: fixable HIGH/CRITICAL vulnerabilities in both npm lockfiles |
| `trivy-secrets` | TEST | Trivy secret scanner plus the pattern scanner (`scan-credentials.mjs`, which never prints a matched value) |

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

## Findings and resolutions

Recorded while introducing the gate (2026-10-27); the branch is rebased on `origin/main@14d4126`.

### Previously failing Vitest tests: resolved upstream, not by this branch

On `2c841d3` three tests failed (`AiChatEsc`, two `FileExplorerDrag`). History shows commit `2c841d3` overwrote `FileExplorer.jsx` and `AiChat.jsx` without the drag-to-move and Esc code that `docs/files-drag-drop-move.md` and `docs/ai-chat-esc-close.md` describe; `main` re-landed both (`21c5a05`, `e4b41dd`, `14d4126`). After the rebase **Vitest is 46/46**, so `ci/known-failures.json` is empty and this branch carries no copy of those fixes. The list mechanism stays: any new failing test fails the build, and an entry that starts passing must be deleted. Whether the *deployed* Vercel frontend matches `main` was not checked (no Vercel access).

### Dependencies changed to clear Trivy

Trivy now reports **no HIGH/CRITICAL findings** in either lockfile, with an empty `.trivyignore` (no exception, no bypass).

| Change | Why | Compatibility check |
| --- | --- | --- |
| `backend`: `npm audit fix` (lockfile only) | `axios`, `multer`, `body-parser`, `ws`, `follow-redirects`, `form-data` and `proxy-addr` (CRITICAL) | semver-compatible updates; lint, syntax check of 40 files, tests pass |
| `frontend`: `npm audit fix` (lockfile only) | `axios`, `dompurify`, `follow-redirects`, `form-data`, `postcss`, `source-map-js`, `ws`, `nanoid` | semver-compatible updates |
| `overrides`: `nanoid` 3.3.20 for `@excalidraw/excalidraw` | it pins `nanoid` exactly to 3.3.3 (vulnerable) | same major; Excalidraw only calls `nanoid()` |
| `overrides`: `nanoid` 5.1.16 for `@excalidraw/mermaid-to-excalidraw` | it pins exactly 4.0.2 and no 4.x fix exists | 4 → 5 is a major, but the package only does `import { nanoid } from "nanoid"` / `nanoid()`, unchanged in 5 (ESM, Node 18+) |
| `overrides`: `lodash-es` 4.18.1 | `chevrotain` pins 4.17.21 exactly | minor of the same line; 4.18.1 was already resolved by the other consumers (`mermaid`, `dagre-d3-es`) |
| `vite` ^5.2.11 → ^6.4.5 | two HIGH CVEs (fixed from 6.4.4) | peers allow 6 for `@tailwindcss/vite` (5–8), `@vitejs/plugin-react` (4–7) and `vitest` (5–7). Vite 6 still supports Node 18, unlike Vite 7 (needs 20.19+ / 22.12+), so the Vercel Node version cannot break the build. Build, dev server, Vitest and Playwright all pass |

Validation of the overrides: `npm ls` shows them applied with no invalid-tree errors; the production build bundles Excalidraw/mermaid/nanoid; and `frontend/e2e/compat.spec.js` loads the Excalidraw whiteboard in real Chromium (synthetic board) and fails on any runtime error. **Not covered:** an actual Mermaid→Excalidraw conversion and real-time whiteboard collaboration; run a manual whiteboard session on a Vercel Preview before merging.

Still open (dev-only, not shipped, ignored by Trivy because it skips dev dependencies): `npm audit` reports `vitest`/`tinypool` (critical) which needs the `vitest@5` major, and one moderate `qs` advisory in the backend. Treat them as a separate upgrade.

### Other findings

- `backend/src/controllers/taskController.js` references two undefined identifiers (`employeeSeesMappedRow`, `reportedEnd`), so sub-task listing as a non-admin and moving a task to *done* throw `ReferenceError` in the legacy Express API. The production API is the edge function, which implements both. ESLint reports them as warnings for that one file only (comment in `backend/eslint.config.js`).
- `frontend/src/components/{BookingCalendar,AvailabilityPopover,use-bookings}` import modules that do not exist here and are used nowhere; `tsconfig.ci.json` excludes them.
- **Packaging bugs found only by running from a fresh checkout** (both fixed and guarded by tests): the repo's `.gitignore` rule `**/*secret*` had silently excluded the credential scanner (now `ci/pipeline/scan-credentials.mjs`), and Windows shells split arguments at spaces so a checkout under a folder like `test project` broke Vitest and Trivy (`ci/lib/spawn.mjs` now quotes). Also: a CRLF checkout (`core.autocrlf`) needs the line-ending normalisation in `ci/tests/config.test.mjs`, and long paths need `git config core.longpaths true`.
- Trivy scans files on disk, not just tracked ones, so a stale untracked file (even an ignored one) can fail the secrets stage; Jenkins starts from a clean workspace.

## Jenkins runtime

`ci/jenkins/` builds one image (pinned Jenkins LTS, Node 22, Trivy and Playwright Chromium, tarballs checksum-verified) and runs it with `docker-compose.yml`: **no `docker.sock`, not privileged, `cap_drop: ALL`, `no-new-privileges`, 2 CPUs / 4 GB / pid limit, its own network and volume, published on `127.0.0.1:8088` only**, one executor. `ci/jenkins/install-on-15.sh` refuses to run without `APPROVED_BY`, checks RAM, disk, port and name collisions first (`--check` runs only those), only creates `taskflow-*` resources and never touches existing ones. Every `${…}` in `casc/jenkins.yaml` is required, so a missing secret stops startup. Without a webhook route the multibranch job polls GitHub every 5 minutes.

| Credential | Purpose |
| --- | --- |
| `taskflow-attest-private-key` | Ed25519 key that signs attestations (generate on the Jenkins host with `ci/gate/generate-keypair.mjs`) |
| `taskflow-github-app-id`, `-installation-id`, `-key` | GitHub App that publishes `unimisk/verified` |
| `JENKINS_ADMIN_PASSWORD`, `JENKINS_URL` | JCasC admin and URL |

No secret is stored in the repository; the secret scanner and a test enforce that.

## Remaining setup before real Jenkins activation (nothing here has been done)

1. Install Jenkins on `192.168.23.15`: `ci/jenkins/install-on-15.sh --check`, then with `APPROVED_BY` after you approve. This also builds and Trivy-scans the Jenkins image, which has not been run (no Docker daemon locally).
2. Generate the attestation key **on the Jenkins host** (`ci/gate/generate-keypair.mjs`), store the private key as the `taskflow-attest-private-key` credential, and commit the public key as `ci/gate/attest-public-key.pem`. Until then `pr-ready` correctly reports the key as not provisioned.
3. Create the GitHub App (Checks: write), install it on the repository, and store its id, installation id and key as Jenkins credentials.
4. Copy `ci/github/CODEOWNERS.proposed` to `.github/CODEOWNERS` with the real admin team, then `ci/github/branch-protection.mjs --apply` (dry run first). Confirm GitHub shows `unimisk/verified` as required from the App.
5. In Vercel confirm: production branch is `main`; Preview has its own `VITE_*` values (`ci/verify/env-separation.mjs --vercel-env env.json`); the Node version is 18 or newer.
6. Run one real Jenkins build of this branch and check that the multibranch job, the `Jenkinsfile` syntax and the `unimisk/verified` check behave as the local runs did.
7. Manual whiteboard check on a Vercel Preview (see the dependency validation note) and a comparison of the deployed frontend with `main`.
8. Optional: a Cloudflare route so GitHub webhooks reach Jenkins (otherwise the job polls every 5 minutes).

## Verification

```bash
npm --prefix frontend ci && npm --prefix backend ci
(cd frontend && npx playwright install chromium)
export TRIVY_BIN=/path/to/trivy
for s in lint typecheck build unit-tests backend-tests e2e trivy-deps trivy-secrets; do node ci/pipeline/run-stage.mjs $s; done
node ci/gate/attest.mjs        # Jenkins only: needs CI_ATTEST_PRIVATE_KEY
node ci/gate/pr-ready.mjs      # developer: may I open the PR?
```

Results at commit `e18b261` (2026-10-27, Windows, Node 24, Trivy 0.76.1, strict policy, empty `.trivyignore`):

| Stage | Result |
| --- | --- |
| lint | PASS (warnings only) |
| typecheck | PASS |
| build (+ no production host in the bundle) | PASS |
| unit-tests (Vitest) | PASS (no known failures) |
| backend-tests (GitHub integration, AI core, pipeline tests, 40 backend files syntax) | PASS |
| e2e (Playwright, 11 tests incl. isolation, failure paths and the Excalidraw compatibility check) | PASS |
| trivy-deps | PASS (no HIGH/CRITICAL, no exceptions) |
| trivy-secrets | PASS |

Gate scenarios (real runs, throwaway signing key):

| Scenario | Result |
| --- | --- |
| All eight stages green, then `attest` and `pr-ready` | PASS: attested, READY |
| Uncommitted edit after verification | PASS: NOT READY |
| Committed code change after verification | PASS: NOT READY ("content changed"); re-attesting without re-running stages refused (all results STALE) |
| Attestation older than 7 days | PASS: NOT READY ("expired") |
| Signed by another key / payload edited after signing | PASS: NOT READY ("signature invalid") |
| Lint error, type error, failing unit test (each on a throw-away branch) | PASS: stage fails, no attestation written |
| Committed fake token | PASS: Trivy secret stage fails, no attestation |
| Old (vulnerable) backend lockfile | PASS: `trivy-deps` fails, no attestation |
| Trivy binary missing | PASS: stage fails instead of looking clean |

Also verified: a fresh clone of the commit (`git clone`, `npm ci`, then all eight stages) reproduces the results; the `ci_runs`/`/ci/*`/pipeline-UI features do not exist (`git diff origin/main` touches nothing under `supabase/`, `backend/src/` or application screens).

**BLOCKED (not run):** Jenkins image build/start and the Jenkinsfile executing on Jenkins; the live `unimisk/verified` check, branch protection and CODEOWNERS (need the GitHub App and an admin token); the Vercel Preview/Production variable audit and production-branch setting; comparing the deployed bundle with `main`.

## Revision log

| Date | Change |
| --- | --- |
| 2026-10-27 | Jenkins pipeline, signed pre-PR gate, branch-protection preparation, Jenkins as code, safe Playwright suite. No change to the TaskFlow application's features. |
| 2026-10-27 | Final verification: gate scenarios, Trivy audit with upgrade options, root cause of the quarantined tests (main moved on), CRLF-safe config tests. |
| 2026-10-27 | Rebased onto `main@14d4126`; Trivy findings cleared with lockfile fixes, validated `overrides` and Vite 6; fixed two packaging bugs found by a fresh-checkout run; all eight stages and the gate scenarios pass. |
