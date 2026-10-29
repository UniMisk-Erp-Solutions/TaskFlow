# Engineering quality gates (UniMisk standard)

Implements the UniMisk quality standard (12 categories, phases 1 to 3) on top of the existing Jenkins pipeline. Nothing in the old pipeline was removed: the trusted pipeline, the verification-before-PR gate, the signed attestation and the admin-only merge are unchanged. Four stages were added; they are fast (about 5 seconds together), static, and block only **new or worsened** problems.

> Status: built and tested locally (112 CI tests pass), pushed on `feature/ci-cd-pipeline`. **Not active in Jenkins until the branch is merged to `main` and the central Jenkinsfile and gate pin are updated** (see [Activation](#activation)).

## How blocking works (read this first)

The existing code has debt. Failing every branch on day one would block all work, so each project has a **baseline** (`ci/verify/quality/baseline.json`) that records today's problems.

- A problem **already in the baseline** is listed as "known" and never fails a build.
- A **new** problem fails. A known problem that gets **worse** (a function that grows from 17 to 25 complexity) fails too.
- Fixing debt lowers what is tolerated the next time an admin refreshes the baseline.
- The engine, the policy and the baseline sit in `ci/verify/`, a folder the gate already pins. A branch cannot edit them, and a change to them is "pipeline changed" and needs admin review.

Every failure prints the rule, file, line, severity and a suggested fix, and the first one is also the text on the GitHub commit status:

```
✘ [ARCH-003] frontend/src/components/ZzProbe.jsx:1  UI components must not use the database client directly; go through api.js or a data hook: imports "../supabaseClient" → move the query into api.js (or a use*.js hook) and call that from the component
```

## The 12 categories: where each is enforced

| # | Category | Stage | Status |
|---|---|---|---|
| 01 | Formatting and style | Code standards (hygiene: trailing whitespace, mixed line endings, final newline) + existing Lint | **Partial.** Prettier itself is not added (it would reformat the whole codebase); see [Not yet implemented](#not-yet-implemented) |
| 02 | Type safety | Code standards (`any`, `as unknown as`) + existing Typecheck | **Partial.** Strict mode and unhandled-promise checks need typed linting |
| 03 | Complexity and readability | Maintainability | **Done** |
| 04 | File and component structure | Maintainability (file size, function size) | **Done** (measured, with exemptions for tests) |
| 05 | Software architecture | Architecture | **Done** for TaskFlow |
| 06 | Design and maintainability | Architecture + Maintainability (duplication) | **Done** (rules plus measurements; reviews still needed for judgement calls) |
| 07 | API and backend engineering | existing Backend tests | **Not yet.** Needs API contract and authorization tests per project |
| 08 | Database engineering | none yet | **Not yet.** Needs a disposable test database |
| 09 | Security | existing Secrets and Dependencies + Code standards (HTML injection, `eval`) | **Partial.** SAST (Semgrep) not added |
| 10 | Testing quality | existing Vitest, Backend, E2E + Repository policy (tests may not be deleted, skipped or focused) | **Partial.** Coverage gate not added |
| 11 | Performance and reliability | existing Vite build | **Not yet.** Bundle budgets need a per-app baseline |
| 12 | Repository hygiene | Repository policy | **Done** |

## Stages and rules

New stage names in the pipeline (group "Engineering quality", run in parallel after Install): `repo-policy`, `code-standards`, `maintainability`, `architecture`. All four are required checks, so the gate will not sign a commit that fails them.

### Maintainability (`maintainability`)

| Rule | Check | Warn | Fail (new/worse) |
|---|---|---|---|
| MAINT-001 / 002 | Function length (code lines, no blanks or comments) | over 60 | over 100 |
| MAINT-003 / 004 | Cyclomatic complexity | over 10 | over 15 |
| MAINT-005 | Cognitive complexity (SonarSource style; an approximation) | | over 15 |
| MAINT-006 | Nesting depth of control flow | | over 4 |
| MAINT-007 | Function parameters | over 5 | |
| MAINT-008 / 009 | File length (code lines) | over 400 | over 700 |
| MAINT-010 | Duplicated code (50-token windows, compared by identifier text) | | above 3% or above baseline + 0.25 |

### Code standards (`code-standards`)

| Rule | Check |
|---|---|
| STD-001 | explicit `any` (TypeScript files) |
| STD-003 | unsafe double cast `as unknown as T` |
| STD-004 | `console.log/debug/trace` in production code (folders in `consoleAllowed` excepted) |
| STD-005 | `debugger` |
| STD-006 | HTML injection: `dangerouslySetInnerHTML`, `.innerHTML =`, `insertAdjacentHTML`, `document.write` |
| STD-007 | `eval`, `new Function` |
| STD-008 | non-null assertion `!` (warning only) |
| STD-010 / 011 / 012 | trailing whitespace, mixed CRLF/LF, missing final newline |

### Architecture (`architecture`)

Universal rules: **ARCH-002** no circular dependencies (an existing cycle may not grow), **ARCH-011** no import that resolves to nothing. Everything else comes from the project's policy (see below). Test files are not part of the graph.

### Repository policy (`repo-policy`)

| Rule | Check | Effect |
|---|---|---|
| REPO-001 | every package has a lockfile that lists its dependencies | fail |
| REPO-002 | lint/type suppression comments (`eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, coverage ignores) may not increase per file | fail |
| REPO-003 | tests or test files may not be removed | fail |
| REPO-004 | `.only` anywhere | fail |
| REPO-005 | newly skipped tests (`.skip`, `xit`) | fail |
| REPO-006 | a new dependency | **review** (printed, not blocking; the admin confirms nothing existing already does the job) |
| REPO-007 | protected configuration changed (`tsconfig.json`, `vercel.json`, `render.yaml` for TaskFlow) | fail until an admin re-baselines |

## TaskFlow architecture (what the rules enforce)

TaskFlow has three deployables that must stay separate: the React app (`frontend/`), the Node API (`backend/`) and the Supabase edge function (`supabase/functions/`). Inside them:

| Rule | In plain words |
|---|---|
| ARCH-001 | frontend, backend and edge functions never import each other's code |
| ARCH-003 | UI components and the landing site do not touch the database client; they go through `api.js` or a `use*.js` hook. Only `supabaseClient.js` imports the Supabase SDK |
| ARCH-004 | routes call controllers, controllers call services; routes never reach the database; services, middleware, utils and config never import routes or controllers |
| ARCH-005 | `lib/` (shared helpers) imports no components, pages or app state |
| ARCH-006 | the marketing site (`landing/`) does not import application components |
| ARCH-007 | data hooks and `api.js` do not import UI components |

### Audit of the current code (the baseline, 2026-10-29)

The baseline holds what exists today; none of it blocks work, none may grow.

- **Maintainability:** 154 functions over cognitive complexity 15, 89 over cyclomatic 15, 64 over 100 lines (largest: `ChatPage` 903 lines, `handleTasks` in the edge function 901, `FileExplorer` 747, `AdminDashboard` 739), 9 nested deeper than 4, 5 files over 700 lines. Duplicated code is **13.2%**, mostly the edge function repeating backend controllers and the two near-identical meeting/task detail modals.
- **Architecture:** 5 components use the database client directly (ChatPage, FileExplorer, MeetingDetailModal, TaskDetailModal, WhiteboardPage), 2 `lib/` files import app code, **no circular dependencies**, and **35 broken imports**: 14 in stale duplicate files in `backend/src/` root (`ai.js`, `auth.js`, `email.js`, `tasks.js` and four controllers import `../middleware/...` that does not exist there) and 21 in the booking-calendar files that import a design system TaskFlow does not have (already excluded from the type check).
- **Standards:** 3 files with explicit `any`, 1 with a double cast, 8 with `console.log`, 1 with HTML injection, 8 with trailing whitespace, 2 without a final newline.
- **Repository:** 6 files carry suppression comments; 12 test files with 58 tests are protected from removal.

Cleaning the 35 broken imports (delete the stale duplicates, fix or remove the booking files) is the cheapest first win.

## Commands

```bash
node ci/verify/quality/run.mjs all                       # enforce (what Jenkins runs, per stage: maintainability | standards | architecture | repo-policy)
node ci/verify/quality/run.mjs all --audit               # report everything against the thresholds, never fails (phase 1)
node ci/verify/quality/run.mjs all --update-baseline     # ADMIN ONLY: accept the current tree as the new baseline, reviewed in a pull request
node ci/verify/quality/run.mjs --init                    # new project: write a starter policy.json
node --test ci/tests/quality.test.mjs                    # tests of the engine itself (12 scenarios)
```

Each stage also writes `.ci/quality/<check>.json` (archived by Jenkins) with every violation and warning.

## Universal versus per project

**Universal: the same for every UniMisk project** (copy the `ci/` folder; nothing to edit)

- the engine: `ci/verify/quality/run.mjs` and `lib/`
- the four stages and their names, the stage group in the Jenkinsfile, the gate, attestation and `unimisk/verified` status
- the rule catalogue: all `MAINT-*`, `STD-*`, `REPO-*`, `ARCH-002`, `ARCH-011`, with the default thresholds
- the baseline mechanism (new or worse fails), the failure text, the reports
- Jenkins itself: the server, the dashboard, developer logins and branch visibility

**Per project: each repository needs its own**

| Item | File or place | What to decide |
|---|---|---|
| Source layout | `ci/verify/quality/policy.json`: `sourceRoots`, `packages`, `aliases`, `testPattern`, `exclude`, `consoleAllowed` | where the code and tests live; start with `--init` |
| Architecture rules | `policy.json`: `architecture.rules` and `modules` | the project's real layers and module boundaries. This is the part that needs a person who knows the app |
| Threshold overrides | `policy.json`: `thresholds` | usually leave at the defaults |
| Protected files | `policy.json`: `protectedFiles` | config whose silent change is dangerous (type config, hosting config, CI config) |
| The baseline | `ci/verify/quality/baseline.json` | generate once with `--update-baseline` after the audit |
| Build and test commands | `ci/pipeline/config.mjs` (`STAGES`, `CI_BUILD_ENV`, `PRODUCTION_HOSTS`) | the project's lint, typecheck, build, test and E2E commands and its production hosts that CI must never reach |
| Lint and type config | `eslint.config.js`, `tsconfig.ci.json` | the project's own rules |
| Repository wiring | Jenkins job source, `CI_REPO` in the Jenkinsfile, GitHub webhook, read token | one multibranch job per repository |
| Developer logins | `ci/jenkins/casc/jenkins.yaml` | GitHub usernames and branch prefixes for per-developer visibility |
| Database checks (later) | per-project test database and migrations | see below |

**Onboarding a new project, in order:**
1. Copy `ci/` into the repository; run `node ci/verify/quality/run.mjs --init`.
2. Edit `policy.json` (roots, aliases, tests) and write the architecture rules with the team.
3. Run `all --audit`, read the report, fix cheap findings (broken imports, dead files).
4. Run `all --update-baseline`; commit policy and baseline in a pull request that an admin reviews.
5. Add the project's stages to `ci/pipeline/config.mjs`, create the Jenkins job, add the developers.

## Exceptions

- **Generated code, migrations, declarative config, naturally large files and tests** are excluded through `exclude`, `testPattern` and the baseline (a large fixture is simply recorded once, it never blocks).
- **Console output** is allowed in folders listed in `consoleAllowed` (TaskFlow: `backend/server.js`, `backend/src/config/`).
- **An exception for one violation** is made by an admin through `--update-baseline` in a reviewed pull request. A developer can never add one, and a lint or type suppression comment counts as a violation (REPO-002).
- Cognitive complexity is an approximation of the SonarSource definition, and duplication compares identifier text; both are indicators for review, not proof.

## Not yet implemented

Listed on purpose: a missing scanner must never count as a pass. These are not stages today, so they cannot silently pass.

| Item | What it needs | Universal or per project |
|---|---|---|
| Prettier format check | an agreed Prettier config and a one-time reformat of the codebase (a large diff) | per project |
| Typed lint rules (floating promises, unsafe `any` flows), strict TypeScript | a typed ESLint setup; strict mode only where the code is TypeScript | per project |
| API contract tests, authorization and tenant-isolation tests | tests against a running API with seeded tenants | per project |
| Database integrity (migrations apply, RLS tests, transaction rollback tests) | a **disposable** test database in CI, never the live one | per project |
| SAST (Semgrep) | adding the scanner to the agent image (a reviewed change) | universal tool, per-project rule sets |
| Coverage gate (80% on new code) | coverage output from Vitest and a diff base | per project |
| Bundle-size budgets, load tests | a recorded baseline per application | per project |
| Duplication limited to new code only | the base branch available to the build; today the total is held at baseline + 0.25% | universal |

## Activation

The stages run from the trusted toolkit (`CI_TOOLKIT_REF=main`). Nothing changes for developers until the admin:

1. merges `feature/ci-cd-pipeline` into `main` (manual, as always);
2. rebuilds the Jenkins image so the stored central Jenkinsfile contains the new stage group, and re-pins the gate (`ci/gate-service/pins.sh`) because `ci/pipeline` and `Jenkinsfile` changed;
3. tells developers to merge `main` into their branches: any branch that adds a violation then fails with the exact rule and line.

## Revision log

| Date | Change |
|---|---|
| 2026-10-29 | Quality engine (`ci/verify/quality`), four new required stages (repo-policy, code-standards, maintainability, architecture), TaskFlow policy and baseline from the first audit, 12 engine tests, `--init` for new projects. Rollout phases 1 to 3 (audit, code-level standards, architecture). Phase 4 items listed above. |
