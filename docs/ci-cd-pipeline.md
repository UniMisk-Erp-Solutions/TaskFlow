# CI/CD Pipeline

Developer automation for TaskFlow: **Jenkins** builds and tests every branch, a signed **pre-PR gate** proves an exact version of the code passed everything, an **admin** reviews and merges by hand, and **Vercel** ships production only after that merge.

```
PLAN (TaskFlow task) → CODE (feature branch) → BUILD → TEST → PRE-PR GATE
   → developer opens the PR → ADMIN reviews and merges into main → SHIP (Vercel production)
```

This is tooling around the app, not part of it. **The TaskFlow application gains no pipeline feature**: no tables, no API routes, no UI, no notifications. Nothing in this pipeline merges, deploys, or touches a production database; the frontend stays on Vercel and the backend (Supabase on `192.168.23.15`) is deployed separately by an admin (`scripts/deploy-edge-api.sh`).

> **Status:** implemented on branch `feature/ci-cd-pipeline` (not pushed, merged or deployed). **Jenkins is installed and verified on `192.168.23.15`** in local-verification mode (see [the installation record](#jenkins-installation-on-19216823-15-done-2026-10-27)); the **GitHub App, branch protection and the Vercel checks are still pending** and need an organization owner.

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
4. Only the Jenkins host holds the private key; the public key (`ci/gate/attest-public-key.pub`) is committed, so anyone can verify and no one can forge.
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

## Jenkins installation on `192.168.23.15` (done 2026-10-27)

Jenkins **is installed and running** on the shared server, in local-verification mode (no GitHub App yet). Everything below was created for Jenkins only; no existing container, network, volume, tunnel, database or host setting was changed.

### What exists on the server

| Item | Detail |
| --- | --- |
| Directory `~/taskflow-ci` (mode 0700) | `secrets/` (0700): `attest.pem` (Ed25519 private key, 0400, generated on the host with `openssl genpkey`), `attest-public-key.pem`, `github-app.pem` (**placeholder text** until the GitHub App exists); `.env` (0600: admin password, ids, file paths, mirror settings); `repo/` (clone of the branch, made from a `git bundle`, so **nothing was pushed to GitHub**); `install.log` |
| Container `taskflow-jenkins` | image `unimisk/taskflow-jenkins:2.580.1` (Jenkins 2.580.1 LTS, Node 22.23.3, npm 11.21.0, Trivy 0.76.1, Playwright Chromium 1.64.1); **healthy** |
| Isolation as applied (`docker inspect`) | 4 GiB memory, 2 CPUs, 1024 pids, 1 GiB `/dev/shm`; not privileged; all capabilities dropped except `CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID`; `no-new-privileges`; no `docker.sock`; only network `taskflow_ci`; published **only on `127.0.0.1:8088`**; the repository clone is mounted **read-only** |
| Other new Docker objects | network `taskflow_ci`, volume `taskflow_jenkins_home`, the base image `jenkins/jenkins:2.580.1-lts-jdk21` |
| Jenkins state | security on (anonymous request: 403, wrong password: 401), 1 executor, 4 credentials loaded (`taskflow-github-app-id`, `…-installation-id` (placeholders `0`), `taskflow-github-app-key` (placeholder), `taskflow-attest-private-key`), multibranch job `TaskFlow (local repository, pre-GitHub)` over the read-only clone |

Reach it with an SSH tunnel (`ssh -L 8088:127.0.0.1:8088 olympus@192.168.23.15`, then `http://127.0.0.1:8088/`, user `admin`). The generated admin password is only in `~/taskflow-ci/.env` on the server.

### What the real installation found (and what was changed)

Running it for real exposed problems no local test could; all are fixed in this branch and covered by tests where possible.

| Finding | Fix |
| --- | --- |
| `deb.debian.org` answered at ~20 KB/s and GitHub release downloads at ~9 KB/s from this network (hours for the image) | `DEBIAN_MIRROR` and `JENKINS_UC_DOWNLOAD` build args (apt and the plugin installer still verify signatures/checksums); Trivy is copied from the official image pinned by digest. Build time fell to about 4 minutes. Defaults stay on the official sources. |
| The **pre-start image scan** (Trivy, gates the install) reported 32 fixable HIGH findings and correctly stopped the install | `apt-get upgrade`, a current npm (the one bundled with Node ships vulnerable nested packages), two patched npm-internal packages, removal of the unused `git-lfs` binary, the npx cache and the build-only plugin installer. The rescan is clean and only then did the container start. |
| Jenkins refused to start: `excludeClientIPFromCrumb` no longer exists | removed (default crumb issuer) |
| Every `agent any` build waited forever: node mode `EXCLUSIVE` | `NORMAL` (the container is the isolation boundary) |
| A job with a parameterised branch cannot load its own Jenkinsfile | the local job is now a multibranch job over the clone, which is also how the GitHub job will work |
| Jobs created from JCasC appear only after **Manage Jenkins → Reload Configuration from Disk** following the first start | documented; do it once after every fresh container |
| Public key could not be committed: the repo ignores `*.pem` | stored as `ci/gate/attest-public-key.pub`, with a test |

### Real pipeline results (Jenkins build #2 of `feature/ci-cd-pipeline`, commit `a91c0ab`)

| Stage | Result |
| --- | --- |
| Install, Lint, Typecheck, Secrets (Trivy + pattern scan) | SUCCESS |
| Vite build (+ production-host scan) | SUCCESS |
| Vitest (46 passed, 0 failed), Backend tests (GitHub integration + pipeline tests, 32 AI-core tests, syntax of 40 backend files), Dependencies (Trivy, no exceptions) | SUCCESS |
| E2E (Playwright, 11 tests, headless Chromium without sandbox inside the container) | SUCCESS |
| Attestation | signed by Jenkins; the artifact `.ci/attestation.json` verifies on a developer machine with the committed public key: `READY` |

The whole build took 2 min 45 s. The container peaked at about 1.9 GiB of its 4 GiB and was throttled at its 2-CPU limit.

### Pre-PR gate on real Jenkins attestations

| Scenario | Result |
| --- | --- |
| Clean checkout of the attested commit + its attestation | READY |
| Attestation built with a 90-second lifetime (job parameter `ATTEST_TTL_SECONDS`, test only), checked after 100 s | NOT READY: "attestation expired" |
| One-line code change on a branch, presenting the old attestation | NOT READY: "content changed" (tree and commit differ) |
| The same changed branch with its own Jenkins build and attestation | READY |
| Uncommitted local edits | NOT READY |

### Failure blocking on Jenkins (throw-away branches, never pushed, since deleted)

| Branch content | Jenkins result | Attestation |
| --- | --- | --- |
| ESLint error | Lint FAILED, later stages skipped | none |
| failing unit test | Vitest FAILED | none |
| committed fake GitHub token | Trivy secret scan FAILED (CRITICAL) | none |
| dependency with known HIGH CVEs (`lodash@4.17.15`) | Trivy dependency scan FAILED, Install/Lint/Typecheck/Build/Vitest/Backend SUCCESS | none |
| backend lockfile out of sync with `package.json` | `npm ci` FAILED at Install | none |

The finished builds of these branches remain visible in Jenkins as `demo-*` jobs (disabled once their branches were deleted).

### Operating notes

- Rebuild/restart **only** Jenkins after a config change: `cd ~/taskflow-ci/repo/ci/jenkins && set -a && . ~/taskflow-ci/.env && set +a && docker compose build && docker compose up -d`, then *Reload Configuration from Disk*.
- Update the clone without pushing: `git bundle create` on the dev machine, `scp`, then `git fetch <bundle> feature/ci-cd-pipeline && git merge --ff-only FETCH_HEAD` in `~/taskflow-ci/repo`.
- Remove everything again: `docker compose down` (stops and removes only `taskflow-jenkins` and `taskflow_ci`), then `docker volume rm taskflow_jenkins_home`, `docker image rm unimisk/taskflow-jenkins:2.580.1` and `rm -r ~/taskflow-ci`.
- Other containers on the host were observed restarting during the session (the two NetworkWise Coolify applications were redeployed with a new commit, and the TaskFlow Supabase edge-functions container restarted at 13:36 IST). None of this work touches them, no out-of-memory kill occurred and the host had ~80 GiB free, so they are most likely routine deployments, but the cause could not be confirmed from here.

### GitHub App: the manual authorization step (not done: it needs an organization owner's GitHub login)

1. As an owner of `UniMisk-Erp-Solutions`: Settings → Developer settings → GitHub Apps → **New GitHub App**. Use the values in `ci/github/github-app-manifest.json`: name `UniMisk TaskFlow CI`, **webhook inactive**, permissions **Metadata: read, Contents: read, Pull requests: read, Checks: write, Commit statuses: write** (nothing else), installable only on this account.
2. Generate a private key (downloads a `.pem`), note the **App ID**, then **Install App** → *Only select repositories* → `TaskFlow`; the number in the installation URL is the **installation id**.
3. Convert the key: `openssl pkcs8 -topk8 -inform PEM -outform PEM -in <downloaded>.pem -out github-app.pem -nocrypt`, copy it over `~/taskflow-ci/secrets/github-app.pem` on the server (`chmod 0400`).
4. In `~/taskflow-ci/.env` set `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `CASC_FILES=/usr/share/jenkins/ref/casc/jenkins.yaml,/usr/share/jenkins/ref/casc/github.yaml` (keep `local-verify.yaml` too if you want both jobs); recreate the container (`docker compose up -d`) and reload from disk. Jenkins then scans the repository every 5 minutes and publishes `unimisk/verified` on each commit.
5. Branch protection stays off until you run `ci/github/branch-protection.mjs` yourself (`--apply` only with `APPROVED_BY` and an admin token).

## Jenkins activation: preflight record and runbook

Prepared on 2026-10-27 by **read-only** inspection. Nothing was installed or changed on `192.168.23.15`.

### Preflight on `192.168.23.15` (verified)

`ci/jenkins/install-on-15.sh --check` was piped to the server over SSH (it was not copied there) with placeholder values for the secrets. It printed `✔ safety checks passed (RAM 80562 MB, disk 3007 GB, port 8088 free, no name collisions)` and exited 0. Container names, networks, volumes, image count, listening ports and the home directory were identical before and after. In check mode the script's only state-changing commands (`docker compose build`/`up`) sit after its `exit 0`; every command before it only reads (`/proc/meminfo`, `df`, `ss`, `docker ps`/`network inspect`).

| Item | Finding |
| --- | --- |
| Docker | Engine 29.8.1, Compose 5.5.1, cgroup v2 (systemd), AppArmor + seccomp default profiles, no Swarm; the memory/CPU/pid limits in the compose file can be enforced |
| Capacity | 40 CPUs, 121 GiB RAM with about 80 GiB available, 3.0 TB free on `/` (Docker root), 2% inodes used; load 4–9 at inspection time |
| Port | `8088` free (only `8080`, taken by the Coolify proxy, is nearby); the compose file publishes `127.0.0.1:8088` only |
| Networks | 15 Docker networks, all `10.0.x.0/24` (and one `172.29.250.0/24`); the new `taskflow_ci` bridge gets its own subnet and does not join `coolify` |
| Access | Only `olympus` is in the `docker` group (root-equivalent) |
| Internet from the host | Docker Hub, GitHub, npm, nodejs.org, Debian, Jenkins update site, Playwright CDN and ghcr.io all answered |
| Images | No Jenkins or Node image is cached, so the first build pulls the base image (Docker Hub anonymous pull limit applies) |

Isolation risks that remain and are accepted or need your decision:

- Jenkins runs the code of every branch it builds. Its container has **no `docker.sock`, no privileges, all capabilities dropped (a few re-added for file ownership), 2 CPUs, 4 GB** and its own network, and forks are not built. Docker still lets a container open outbound connections to the LAN and to ports other services publish on this host. If you want that closed, add an egress rule in Docker's `DOCKER-USER` chain; that changes the host firewall and needs your approval.
- Parallel stages share one executor, so a single build can approach 4 GB (JVM 0.8 GB, Vitest, Trivy, Chromium). Watch `docker stats taskflow-jenkins` on the first build and raise `mem_limit` in the compose file if it is OOM-killed; the host has room.
- `JENKINS_ADMIN_PASSWORD` is an environment variable and therefore visible to `docker inspect` (root and `olympus` only).

### Configuration review

Checked statically (YAML parses, the compose file renders with ports, limits, capabilities and security options as intended, all twelve plugins exist on the Jenkins update site). **Two defects were found and fixed in `ci/jenkins/casc/jenkins.yaml`**, both of which would only have shown up after activation:

1. The two key files were loaded with `${base64:${VAR}}`. The variables hold file *paths*, so the credentials would have contained the path text instead of the keys (the JCasC documentation's form for file contents is `readFileBase64`). Fixed, with a test.
2. The repository is private and the branch source had no credential, so scanning would have failed. A `gitHubApp` credential (`taskflow-github-app`) and `scanCredentialsId` were added; the same App key is used for scanning and for publishing the check.

Not verifiable without a running Jenkins (first thing to confirm after start-up, see step 6): the Job DSL block and the `gitHubApp` credential symbol are accepted by the installed plugin versions; look for errors in the container log and at `/configuration-as-code/`.

### Credentials, permissions and keys required

| Item | Detail |
| --- | --- |
| GitHub App (new, installed on `UniMisk-Erp-Solutions/TaskFlow` only) | Repository permissions: **Checks: read & write** (publishes `unimisk/verified`), **Contents: read**, **Metadata: read**, **Pull requests: read**, **Commit statuses: read & write** (Branch Source plugin). No webhook is needed while the job polls. |
| GitHub App private key | Download the `.pem`, then convert it to PKCS#8: `openssl pkcs8 -topk8 -inform PEM -outform PEM -in app.pem -out github-app.pem -nocrypt`. One converted file serves scanning and check publishing. |
| App id, installation id | Numbers from the App's settings page and from the URL of its installation |
| Attestation signing key | Ed25519, generated **on the Jenkins host**: `openssl genpkey -algorithm ed25519 -out attest.pem`; public half: `openssl pkey -in attest.pem -pubout -out attest-public-key.pub`, committed as `ci/gate/attest-public-key.pub` through a normal PR |
| Key files on the host | Owned by `olympus` (uid 1000, which is also Jenkins' uid in the container), mode `0400`, outside any repository directory |
| Environment for the installer | `JENKINS_ADMIN_PASSWORD`, `JENKINS_URL` (the URL your browser will use, e.g. `http://127.0.0.1:8088/` through an SSH tunnel), `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `CI_ATTEST_PRIVATE_KEY_PATH` |
| Admin token for branch protection | A GitHub token with repository-admin rights, used once on an admin's machine for `branch-protection.mjs --apply`, never stored in Jenkins |

Nothing in the repository holds any of these values.

### Runbook (reference: steps 2–6 were executed on 2026-10-27, see the installation record; steps 1, 7 and 8 are pending)

1. **GitHub (admin):** create the App with the permissions above, install it on the TaskFlow repository only, convert the key, note both ids.
2. **Get the code onto `.15` without pushing:** on your machine `git bundle create taskflow-ci.bundle origin/main..feature/ci-cd-pipeline`, copy it with `scp`, then on `.15` clone `main` into a new folder such as `~/taskflow-ci` and `git pull` the bundle. (Pushing the branch is your decision; Jenkins can only build branches that exist on GitHub, so you need that for step 7.)
3. **Keys (on `.15`, as `olympus`):** `umask 077`; generate `attest.pem`; copy `github-app.pem` over; `chmod 0400` both; verify with `openssl pkey -in <file> -noout` (both must print nothing and exit 0).
4. **Preflight with the real values:** `cd ~/taskflow-ci && ./ci/jenkins/install-on-15.sh --check` (read-only).
5. **Install:** `APPROVED_BY="<your name>" ./ci/jenkins/install-on-15.sh`. It builds the image, Trivy-scans it (aborts on a fixable HIGH/CRITICAL), then starts `taskflow-jenkins`. Existing containers are never touched.
6. **Verify Jenkins:** open an SSH tunnel (`ssh -L 8088:127.0.0.1:8088 olympus@192.168.23.15`), browse to `http://127.0.0.1:8088/`, log in as `admin`. Check `docker logs taskflow-jenkins` for JCasC errors, `/configuration-as-code/` for the loaded configuration, and the credentials page for seven entries (including `taskflow-github-app`). Watch `docker stats taskflow-jenkins`.
7. **Test the pre-PR workflow (non-destructive):** push `feature/ci-cd-pipeline` yourself, let the job scan (5 min) or click *Scan*, and expect all stages green. Then:
   - the commit shows `unimisk/verified` = success; download the build's `attestation.json`; run `node ci/gate/pr-ready.mjs --file attestation.json` on your machine (after the public key is committed) and expect READY;
   - push any code change: the old attestation must give NOT READY and a new build must run;
   - push a throw-away branch with a lint error: the check must be `failure` and no attestation is produced.
8. **Branch protection (admin, after step 7 works):** `GITHUB_APP_ID=<id> ADMIN_LOGINS=<admins> node ci/github/branch-protection.mjs` (dry run), review, then `--apply` with `APPROVED_BY` and `GITHUB_ADMIN_TOKEN`; install `.github/CODEOWNERS` first. Open a test PR from an unverified branch and confirm GitHub refuses the merge.
9. **Roll back at any point:** `docker compose -f ci/jenkins/docker-compose.yml down` stops and removes only `taskflow-jenkins` and the `taskflow_ci` network; `docker volume rm taskflow_jenkins_home` additionally deletes its data. Nothing else on the host is involved.

### Remaining security findings

`npm audit` (all severities) after the fixes: **backend** one moderate (`qs`, a non-breaking fix is available); **frontend** 9: 2 critical, 3 moderate, 4 low, **0 high**.

| Finding | Where it lives | Assessment |
| --- | --- | --- |
| `tinypool` prototype pollution leading to code execution (critical) and `vitest` / `@vitest/mocker` (critical, moderate) | dev dependency only; `npm ls --omit=dev` is empty, so it is not in the Vercel bundle and Trivy (which skips dev dependencies) does not report it | Exploitation needs control over test worker options or mock registration, i.e. over the repository's test code, which already runs in CI. Jenkins builds trusted branches only (no forks). Fix needs the `vitest` 5 major; schedule it as a separate change. |
| `react-router` / `react-router-dom` (moderate, open redirect, SSR hydration) | **runtime** dependency, ships to browsers | Below the HIGH gate. The fix is react-router 7 (major); the SSR advisory does not apply to this client-only app. Schedule it. |
| `@excalidraw/excalidraw`, `mermaid`, `katex` (low) | runtime, whiteboard | Fix would downgrade Excalidraw; accept. |
| `qs` (backend, moderate) | backend runtime | `npm audit fix` is non-breaking; apply with the next backend change. |

### Vite 6 and the whiteboard: what must be checked before merge

The compatibility test proves the whiteboard loads in Chromium with the overridden `nanoid`/`lodash-es` and Vite 6 bundling. It does not cover:

- Vercel's Node version must be 18 or newer (Vite 6 requirement; there is no `engines` field in `frontend/package.json`); set or confirm it in the project settings.
- On a Vercel **Preview** built from the branch, sign in with a test account and: draw and reload (scene saved), open the same board in two browsers (realtime sync), upload an image, and use *Text to diagram* (Mermaid to Excalidraw, which exercises `nanoid` 5).
- Confirm the Preview uses its own `VITE_*` values (`ci/verify/env-separation.mjs --vercel-env`).

### No TaskFlow functionality is introduced

Against `origin/main` the branch changes no file under `supabase/` or `backend/src/` (no migration, no edge function, no API route) and no application screen; the only application source file touched is a type-only fix in `Card.tsx`. There is no pipeline dashboard, status tracking, release tracking or notification in TaskFlow; Jenkins reports only through GitHub's `unimisk/verified` check.

## Remaining setup (GitHub, Vercel, branch protection)

Jenkins itself is done. What is left needs an organization owner or access I do not have:

1. **Create and install the GitHub App**, then enable `github.yaml` (manual authorization step in the installation record above). Until then the job builds the local clone and `unimisk/verified` is not published.
2. Copy `ci/github/CODEOWNERS.proposed` to `.github/CODEOWNERS` with the real admin team, then `ci/github/branch-protection.mjs --apply` (dry run first, `APPROVED_BY` and an admin token required). Confirm GitHub shows `unimisk/verified` as required from the App. **Not applied.**
3. **Vercel (BLOCKED):** the connected Vercel account has no project linked to `UniMisk-Erp-Solutions/TaskFlow` (25 projects searched by name and by repository), so the production branch, the Preview/Production `VITE_*` values (`ci/verify/env-separation.mjs --vercel-env env.json`) and the Node version (18 or newer) could not be read. Someone with access to the right team must check them, or give this session access.
4. Manual whiteboard check on a Vercel Preview (see the dependency validation note) and a comparison of the deployed frontend with `main`.
5. Optional: a Cloudflare route so GitHub webhooks reach Jenkins (otherwise the job polls every 5 minutes).
6. Push the branch and open the PR yourself when you are satisfied; nothing here does that.

## Verification

```bash
npm --prefix frontend ci && npm --prefix backend ci
(cd frontend && npx playwright install chromium)
export TRIVY_BIN=/path/to/trivy
for s in lint typecheck build unit-tests backend-tests e2e trivy-deps trivy-secrets; do node ci/pipeline/run-stage.mjs $s; done
node ci/gate/attest.mjs        # Jenkins only: needs CI_ATTEST_PRIVATE_KEY
node ci/gate/pr-ready.mjs      # developer: may I open the PR?
```

Local results at commit `e18b261` (2026-10-27, Windows, Node 24, Trivy 0.76.1, strict policy, empty `.trivyignore`; the Jenkins results are in the installation record):

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

**Also on the real Jenkins (2026-10-27):** all eight stages pass in a container-isolated build, the Jenkins-signed attestation verifies on a developer machine, and expiry, code-change and failure-blocking scenarios behave as designed (see [the installation record](#jenkins-installation-on-19216823-15-done-2026-10-27)).

**BLOCKED (not run):** the live `unimisk/verified` check run, branch protection and CODEOWNERS (need the GitHub App and an admin token); the Vercel Preview/Production variable audit and production-branch setting (no Vercel project for this repository is reachable from here); comparing the deployed bundle with `main`; a Jenkins build of a real GitHub pull request.

## Push-triggered stack rollout on `192.168.23.15`: status (checked 2026-10-27 15:07)

Read-only diagnosis of the rollout of the three-container layout (controller, build agent, gate):

| Check | Finding |
| --- | --- |
| Rollout process | `deploy15.sh` is **no longer running**; it exited with an error (not stuck). |
| Docker build | PASS: `unimisk/taskflow-jenkins:2.580.1` and `unimisk/taskflow-gate:1` both built. |
| Image scan | Jenkins image: clean (0 HIGH/CRITICAL). Gate image scan **FAILED to run**: `scan-image.sh` ran `trivy` inside the scanned image, and the gate image has no Trivy (`exec: "trivy": executable file not found`). A scan that cannot run aborts the rollout by design. |
| Where it stopped | Before `docker compose stop jenkins`: the existing `taskflow-jenkins` (old single-container layout, healthy, 127.0.0.1:8088) was never touched. Agent and gate containers were **not created**. |
| Created so far | Secret files in `~/taskflow-ci/secrets` (mode 0400), `.env` entries for the gate, two images, network `taskflow_ci`. Nothing else. |
| Other workloads | All other containers (Supabase stacks, Coolify, Plausible, ServiceWise, etc.) show the same status as before; host load normal, 3.0 TB disk free. |
| Production deployment | None triggered: no Vercel call, no push, no merge was made by this work. |

**Fix (local, committed on the feature branch, not yet applied on `.15`):** `ci/jenkins/scan-image.sh` now runs the Trivy baked into the Jenkins image (`TRIVY_SCANNER_IMAGE`) against any image tarball.

**Safe recovery (needs approval; nothing was restarted):** sync the fixed branch to `~/taskflow-ci/repo`, then re-run `~/taskflow-ci/deploy15.sh` (idempotent: secrets/`.env` are only created if missing, builds are cached). Its first mutating step is `docker compose stop jenkins`, which interrupts only our own CI controller for about two minutes.

### Rollout completed (2026-10-27, commit `aac6322`)

The first re-run exposed a second finding: the npm bundled in the Node base image carries a HIGH `sigstore` CVE. The gate does not use npm, so `npm`, `npx` and `corepack` are removed from the gate image. Both images then scanned clean and the stack started:

| Container | State | Exposure |
| --- | --- | --- |
| `taskflow-jenkins` | healthy, 0 executors | 127.0.0.1:8088 |
| `taskflow-agent` | connected over WebSocket as `untrusted-1`; not privileged; mounts only its workspace, the read-only repo clone and its own agent secret | none |
| `taskflow-gate` | healthy; `GET /healthz` returns `{"ok":true}`; status mode `record` (no GitHub token yet) | 127.0.0.1:8089 (webhook) and 8090 (admin) |

On start the gate re-verified 10 existing finished builds (recorded locally only; nothing was sent to GitHub).

**Deliberately not tested by the agent** (the owner tests manually). Manual test checklist, run on `.15`:

1. Webhook auth: `docker exec taskflow-gate node ci/gate-service/simulate-delivery.mjs` with a valid, a wrong and a missing signature: expect 202, 401, 401.
2. Duplicate delivery ID: the second delivery returns 200 `duplicate`; no second build.
3. Build of a pushed commit: it runs on the agent, and `GET 127.0.0.1:8090/status` shows `unimisk/verified` recorded as `success` for that SHA.
4. Failing branch: recorded `failure`. A new commit on the same branch: a new build and a new status for the new SHA.
5. Branch that edits the Jenkinsfile or `ci/pipeline`: never signed (`pipeline-changed`).
6. Release gate: `ci/release/deploy-authorized.mjs` refuses without a valid admin approval (dry run by default).
7. Only 8088/8089/8090 listen, and only on 127.0.0.1.

Still BLOCKED, needs the owner: GitHub webhook and tokens (status mode `github-status`), a new Cloudflare tunnel hostname pointing only at gate port 8089, permission to push a test branch, and Vercel access for the deployment-bypass audit.

## Connect GitHub to the running stack (owner actions, in this order)

State on 2026-10-27: the original repository is `UniMisk-Erp-Solutions/TaskFlow` (this checkout's `origin`); `feature/ci-cd-pipeline` is merged with `origin/main@c3701ba` (merge `45fa1dd`), all 78 pipeline tests pass, and the gate's pipeline pins still match the merged tree (no gate rebuild needed). Nothing has been pushed: the push URL of this checkout is deliberately disabled.

**Production data isolation (verified from the configuration, not by running anything against a database).** Every pipeline stage builds with `CI_BUILD_ENV` (`http://127.0.0.1:4010`, a fake anon key); Playwright talks to a mocked API on loopback and refuses any `VITE_*`/`E2E_*` value containing a production host; `ci/verify/env-separation.mjs` checks the built bundle; the agent container has no Supabase, Vercel or GitHub credentials and no route to the gate; the pipeline contains no migration, reset or SQL step. The existing TaskFlow application and Supabase stack were never touched.

| # | Who | Action |
| --- | --- | --- |
| 1 | owner | Create two **fine-grained personal access tokens** (Settings > Developer settings), repository `TaskFlow` only: **read** token = Contents, Pull requests, Metadata: read; **status** token = Commit statuses: read/write, Metadata: read. |
| 2 | owner | Put them on `.15` (never in chat or Git): `~/taskflow-ci/secrets/github-read-token` and `gate-github-token` (mode 0400), set `GITHUB_READ_USER=<your GitHub username>` and `GATE_STATUS_MODE=github-status` in `~/taskflow-ci/.env`, and add `/usr/share/jenkins/ref/casc/github.yaml` to `CASC_FILES`. |
| 3 | owner | Cloudflare: create a **new** named tunnel (do not edit `cloudflared.service` or `cloudflared-networkwise.service`) with one public hostname, e.g. `taskflow-ci-hooks.<your-domain>`, service `http://127.0.0.1:8089`. Only the gate's webhook port is published, never Jenkins (8088) or the gate admin port (8090). |
| 4 | owner | GitHub repo > Settings > Webhooks > Add: payload URL `https://taskflow-ci-hooks.<your-domain>/github`, content type `application/json`, secret = the contents of `~/taskflow-ci/secrets/gate-webhook-secret`, events: **Pushes** and **Pull requests**. |
| 5 | owner | Approve pushing `feature/ci-cd-pipeline` and a disposable `ci-test/*` branch (or add a write credential to this checkout). |
| 6 | owner | Vercel: Project > Settings > Git: set **Ignored Build Step** so only a deployment approved through `ci/release/deploy-authorized.mjs` can reach Production, and remove deploy hooks and unused tokens. The TaskFlow Vercel project is not visible from the connected Vercel account, so this audit is BLOCKED until you grant access. |

Free-plan limit that stays true: private-repo branch protection is not enforceable, so "admin-only merge" is enforced by the independent release gate (Jenkins attestation + admin-signed approval), not by GitHub.

**Rollback:** remove the webhook in GitHub, revert `.env` (`GATE_STATUS_MODE=record`, drop `github.yaml` from `CASC_FILES`), `docker compose up -d jenkins gate`. The application, its database and the existing tunnels are never involved.

## Final verification record (2026-10-27)

| Check | Result |
| --- | --- |
| `df2bf68`: Jenkins build #3 (automatic), all 8 stages | PASS; `unimisk/verified` = success on GitHub |
| `d882ef2` (pushed to the feature branch only, never `main`): Jenkins detected it on its own, build #4 ran all 8 stages, gate published a fresh `unimisk/verified` = success ("All 8 required checks passed (build #4)") | PASS |
| Release gate (Jenkins attestation + admin approval; dry run by default) | unit tests PASS (12); not exercised live; **no production deployment was made** |
| Vercel Preview isolation, production-deploy bypass audit | **BLOCKED**: the connected Vercel account only sees team `mithil1105s-projects`; TaskFlow lives in `unimisk-erp-solutions-projects`. Observed fact: every pushed branch gets a Vercel deployment (status context `Vercel`). Do not treat production as protected until the checklist below is done. |

**Rotating the exposed tokens (owner, GitHub only; secrets are typed on the CI host, never pasted into chat):**
1. Create one **classic** token with only `repo:status` (short expiry) and one **read** token (fine-grained, TaskFlow only, Contents + Pull requests + Metadata read; the repository is public, so a read token is optional).
2. On `.15`: `read -rs T; printf '%s' "$T" > ~/taskflow-ci/secrets/gate-github-token` (mode 0400; same for `github-read-token`), then `bash ~/taskflow-ci/activate-github.sh`.
3. Confirm the next build still publishes `unimisk/verified`, **then** revoke the three old tokens in GitHub > Settings > Developer settings.

**Vercel checklist (owner or after granting access to team `unimisk-erp-solutions-projects`):** Project `task-flow` > Settings > Git: which branch is Production; Preview env vars point to a non-production Supabase project; Deploy Hooks removed; Ignored Build Step / "Require verified commits" set; list of members and tokens that can deploy. Only after all bypasses are closed may the deployment gate (`ci/release/deploy-authorized.mjs`) be declared the only production path.

**Limits:** GitHub Free cannot enforce branch protection on a private repo, so merge control is the release gate plus review, not GitHub. The webhook/Cloudflare tunnel is not confirmed from this host; without it Jenkins still picks pushes up on its scan interval (about 1 minute here).

## Central pipeline: branches need no pipeline files (2026-10-27)

Any branch of the repository is built by the same pipeline, whether or not it contains a `Jenkinsfile`.

| Piece | Where it lives |
| --- | --- |
| Jenkinsfile for branches that have none | stored in Jenkins (`ci/jenkins/casc/Jenkinsfile.central`, loaded through JCasC config file `taskflow-central-jenkinsfile`; Pipeline Multibranch with defaults). A test keeps it byte-identical to the repository `Jenkinsfile`. |
| `ci/` scripts, ESLint/TypeScript/Playwright setup | taken from the **trusted ref** (`CI_TOOLKIT_REF`, now `feature/ci-cd-pipeline`, **`main` once the pipeline is merged**) by `ci/pipeline/overlay.mjs` on every build. The branch's own copies are overwritten, so a branch cannot weaken the pipeline that judges it. Only missing lint/typecheck/e2e scripts and devDependencies are added to `package.json`; application code and runtime dependencies are never touched. |
| Trust | the build records the toolkit commit (`.ci/toolkit.json`); the gate re-derives the toolkit's pipeline-file hashes from Git and signs only when they equal the admin-approved pin baked into the gate image. A branch that ships its own different `Jenkinsfile` is refused. |

**After merging the pipeline into `main`:** set `CI_TOOLKIT_REF=main` in `~/taskflow-ci/.env` on `.15`, then `docker compose up -d jenkins` from `ci/jenkins`. **Changing any pipeline file** (`Jenkinsfile`, `ci/pipeline`, `ci/lib`, `ci/gate`, `ci/verify`) needs a gate re-pin: rebuild the gate image from the reviewed commit (`ci/gate-service/pins.sh`).

**Honest limits:** a branch based on old `main` is judged by the full pipeline, so it can legitimately FAIL (for example `trivy-deps`) on vulnerabilities that `main` still carries; that is a real finding, not a pipeline fault. The repository is public, so the toolkit is fetched anonymously; a private repository would need a read credential for that step.

**Manual test steps:** push any change to any branch (no pipeline files needed); within about 1-3 minutes GitHub shows `unimisk/verified` (pending, then success/failure) on the commit; Jenkins job `taskflow` shows the branch with stages Trusted pipeline, Install, Lint, Typecheck, Secrets, Vite build, Vitest, Backend tests, Dependencies, E2E.

## Production workflow with free tools (the common CI/CD flow on this stack)

The repository is **public**, so GitHub branch protection and rulesets are free. Flow and who does what:

| Step | How it works here | Status |
| --- | --- | --- |
| 1 Plan and code | developer works on a branch | works |
| 2 Pull request | PR template with checklist (`.github/pull_request_template.md`) | in repo |
| 3 CI | push or PR -> Jenkins central pipeline (8 checks) -> `unimisk/verified` on the commit | works |
| 4 Review | **owner setting:** a ruleset on `main` requiring the status check `unimisk/verified`, 1 approval and Code Owners review (`.github/CODEOWNERS` covers `ci/`, `Jenkinsfile`, `.github/`, `vercel.json`) | **needs owner** |
| 5 Merge to main | after merge Jenkins builds `main` the same way (it is just another branch) | works once the pipeline is merged |
| 6 Staging | with Vercel **Production Branch = `production`**, every push to `main` becomes a Vercel *Preview* (stable `main` branch URL). Preview environment variables must point to a **separate free Supabase project** with test data | **needs owner (Vercel)** |
| 7 Production deploy | admin runs `ci/release/deploy-authorized.mjs` on the gate host: it checks the Jenkins attestation AND the admin-signed approval for that exact commit and tree, then fast-forwards the `production` branch to it. Vercel builds Production only from that branch. Dry run by default | built; **not enabled or tested** |
| 8 Monitor and rollback | Jenkins job `taskflow-monitor` GETs the production URL every 10 minutes (red build = down; set `MONITOR_URL` in `~/taskflow-ci/.env`). Rollback = Vercel **Instant Rollback** (Deployments > previous production deployment > Promote) or, if needed, reset `production` to the previous approved commit | monitor deployed; rollback is a Vercel dashboard action |

**Owner actions, in order**
1. GitHub repo > Settings > Rules > Rulesets > New branch ruleset for `main`: require a pull request (1 approval, code owner review), require status check **`unimisk/verified`**, block force pushes and deletion. Second ruleset for `production`: only admins can push, no force pushes.
2. Merge `feature/ci-cd-pipeline` into `main` after review. Then set `CI_TOOLKIT_REF=main` in `~/taskflow-ci/.env` on `.15` and `docker compose up -d jenkins` (from `ci/jenkins`).
3. Create the `production` branch from the approved `main` commit.
4. Vercel project `task-flow` > Settings > Git: Production Branch = `production`; Environment Variables: Preview = staging Supabase project, Production = live; remove deploy hooks and unused tokens.
5. On the gate host keep three separate secrets: the Jenkins attestation key (already there), the admin's approval key (admin machine only), and a GitHub token able to push to `production` (`RELEASE_GITHUB_TOKEN_FILE`, used only by the release command).

**Release procedure (admin):** confirm `unimisk/verified` is green on the `main` commit and staging looks right -> `node ci/release/approve.mjs ...` on the admin machine -> `RELEASE_DEPLOY_ENABLED=yes node ci/release/deploy-authorized.mjs ...` on the gate host -> `node ci/release/smoke.mjs --url <production url>`.

**Limits:** Jenkins stays the free CI; Vercel does the actual hosting. Until steps 1, 4 and 5 are done, GitHub does not block merges and Vercel still deploys production from `main` on its own, so production is not protected by this pipeline.

## Instant push detection (no webhook, no tunnel)

The gate asks GitHub every `GATE_WATCH_SECONDS` (default 10; `0` disables) whether any branch tip moved (`ci/gate-service/ref-watcher.mjs`). The request is conditional (`If-None-Match`): GitHub answers `304` while nothing changed, which is free and does not use the rate limit. When a tip moves (push, new branch, update of a PR branch) the gate triggers a Jenkins scan immediately, so a build starts within seconds of a push. Nothing is exposed to the internet, no Cloudflare tunnel and no repository-admin action is needed. The GitHub webhook (`POST /github`) remains supported as an alternative, and the periodic scan (`GATE_SCAN_EVERY_SECONDS`, 120) stays as the recovery path. Gate log line on detection: `push detected on GitHub: scanning Jenkins`.

## Revision log

| Date | Change |
| --- | --- |
| 2026-10-27 | Push-triggered stack rollout diagnosed: build OK, gate image scan could not run (no Trivy in gate image), old Jenkins untouched; scan script fixed locally; recovery steps recorded. |
| 2026-10-27 | Rollout completed: npm removed from gate image (sigstore CVE), both images scan clean, controller + agent + gate running and healthy; manual test checklist recorded. Live GitHub, Cloudflare and Vercel steps pending.
| 2026-10-27 | Merged origin/main (c3701ba); production-data isolation reviewed; owner action list for GitHub webhook, tokens, Cloudflare tunnel and Vercel added. |
| 2026-10-27 | Added `ci/jenkins/activate-github.sh` (copy at `~/taskflow-ci/activate-github.sh` on .15): once both token files hold real tokens, `bash ~/taskflow-ci/activate-github.sh` switches the gate to `github-status`, enables `github.yaml` and recreates only Jenkins and the gate. Push of the feature branch was refused (403: the stored GitHub login `Priyanshulila` has no write access); push URL left disabled. |
| 2026-10-27 | GitHub mode activated on .15 with the owner's two read-only tokens: Jenkins job `taskflow` (GitHub branch source, PR heads, forks off) loads and indexes the repo; gate reads commits from GitHub. Findings: (1) `traits {}` is not valid Job DSL, replaced by `buildOriginBranch/buildOriginBranchWithPR/buildOriginPRHead`; (2) Job DSL jobs need a Jenkins reload (now in the script); (3) **neither token can write commit statuses** (GitHub returns 403): the status token needs "Commit statuses: Read and write" and the org must allow it. Until then GitHub shows no `unimisk/verified` status. |
| 2026-10-27 | Live push flow verified on GitHub: pushed `feature/ci-cd-pipeline@df2bf68` -> Jenkins built it automatically on the agent (build #3, all 8 stages PASS, E2E workers capped at 2) -> the gate verified it independently and published `unimisk/verified` = success on that exact commit. Fixes found live: classic PAT with `repo:status` is required (fine-grained tokens owned by a user cannot write statuses on an organization repo); gate state keys now include the Jenkins folder (a second job reusing branch+build numbers was silently skipped). Found: Vercel already creates a Preview deployment for pushed branches (status context `Vercel`); the Vercel audit stays BLOCKED until access to team `unimisk-erp-solutions-projects` is granted. |
| 2026-10-27 | Final verification: d882ef2 detected and built automatically (build #4, 8/8) with a fresh `unimisk/verified` success; token-rotation and Vercel checklists recorded; Vercel audit and production deployment lock remain BLOCKED. |
| 2026-10-27 | Central pipeline: Jenkinsfile stored in Jenkins plus a trusted CI toolkit overlay (`ci/pipeline/overlay.mjs`) so branches need no pipeline files; the gate pins the toolkit; tests added (84 pass). |
| 2026-10-27 | Free production workflow: CODEOWNERS, PR template, release promotion by fast-forwarding the `production` branch (no Vercel token), read-only smoke check, Jenkins `taskflow-monitor` health job; owner actions listed (rulesets, Vercel Production Branch, staging Supabase). |
| 2026-10-27 | Instant push detection: the gate polls GitHub branch tips every 10 s with conditional requests and triggers the Jenkins scan on change (no webhook, tunnel or open port); 90 pipeline tests pass. |
| 2026-10-27 | Jenkins pipeline, signed pre-PR gate, branch-protection preparation, Jenkins as code, safe Playwright suite. No change to the TaskFlow application's features. |
| 2026-10-27 | Final verification: gate scenarios, Trivy audit with upgrade options, root cause of the quarantined tests (main moved on), CRLF-safe config tests. |
| 2026-10-27 | Jenkins installed on `192.168.23.15` (isolated container, local-verification mode) and the pipeline run for real: all eight stages pass, attestation verified, expiry/change/failure scenarios proven; fixes found by the real run (mirrors, image-scan findings, JCasC settings, node mode, multibranch job, `.pub` key); GitHub App manifest added; GitHub App, branch protection and Vercel pending. |
| 2026-10-27 | Jenkins activation prepared (read-only): preflight on `.15` recorded, JCasC fixed (key files were loaded as path text; repository scan credential was missing), credentials/GitHub App permissions, residual `npm audit` findings, Vite 6 whiteboard checks and the install/test runbook documented. Nothing installed. |
| 2026-10-27 | Rebased onto `main@14d4126`; Trivy findings cleared with lockfile fixes, validated `overrides` and Vite 6; fixed two packaging bugs found by a fresh-checkout run; all eight stages and the gate scenarios pass. |
