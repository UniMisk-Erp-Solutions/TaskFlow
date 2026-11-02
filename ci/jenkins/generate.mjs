#!/usr/bin/env node
// Generates the project-specific parts of the Jenkins configuration from ci/projects.json, so a project is described once:
//   casc/jenkins.yaml   developer logins, who is admin, the per-project folder and branch roles, the central Jenkinsfile entries
//   casc/github.yaml    one multibranch job per project
// Only the regions between "generated:<name>" markers (and the job script's template) are written; everything else in those
// files is hand-written and untouched. `--check` fails when a committed file differs from what the registry would produce
// (a test runs it), so the registry and the Jenkins configuration cannot drift apart.
//   node ci/jenkins/generate.mjs           write
//   node ci/jenkins/generate.mjs --check   verify only
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRegistry } from "../gate-service/projects.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BS = String.fromCharCode(92);
const reEsc = (s) => s.replace(/[.]/g, `${BS}${BS}.`); // a "." in a prefix is a literal dot; written twice because the pattern sits in a YAML double-quoted string

function region(text, name, body, indent, comment) {
  const open = `${indent}${comment} >>> generated:${name} (from ci/projects.json: do not edit by hand)`;
  const close = `${indent}${comment} <<< generated:${name}`;
  const rx = new RegExp(`^[ ]*${comment.replace(/[/]/g, "[/]")} >>> generated:${name}[^\\n]*\\n[\\s\\S]*?^[ ]*${comment.replace(/[/]/g, "[/]")} <<< generated:${name}[ ]*$`, "m");
  if (!rx.test(text)) throw new Error(`marker "generated:${name}" not found`);
  return text.replace(rx, () => `${open}\n${body}${close}`);
}

/** `^(main|(a|b)/.*)$` for a project built only for main and its developers' branches (a dot in a prefix is escaped for the Groovy string). */
export function branchRegexFor(p) {
  if (p.branchFilter !== "developers") return null;
  const prefixes = [...new Set(p.developers.flatMap((d) => d.prefixes))].map((x) => x.replace(/[.]/g, `${BS}${BS}.`));
  return prefixes.length ? `^(main|(${prefixes.join("|")})/.*)$` : "^main$";
}

export function renderJenkinsYaml(text, reg) {
  const devUsers = reg.projects.flatMap((p) => p.developers.map((d) => d.user));
  const uniq = [...new Set(devUsers)];
  const users = uniq.map((u) => `        - id: "${u}"      # branch developer: sees only their own branches (roleBased below)\n          password: "\${trim:\${readFile:\${DEV_USERS_PASSWORD_FILE}}}"\n`).join("");
  const admins = reg.admins.map((a) => `              - user: "${a}"\n`).join("");
  let roles = "";
  for (const p of reg.projects) {
    roles += `          - name: "folder-${p.id}"\n            description: "The ${p.displayName} folder itself, so a developer can open it; it lists only the children they may read"\n            pattern: "^${p.jenkinsFolder}$"\n            permissions: ["Job/Read", "Job/Discover"]\n            entries:\n`;
    roles += p.developers.map((d) => `              - user: "${d.user}"\n`).join("") || `              - user: "gate"\n`;
    for (const d of p.developers) {
      const alt = d.prefixes.map(reEsc).join("|");
      roles += `          - name: "branches-${p.id}-${d.user}"\n            description: "Branches of ${d.user} in ${p.displayName}"\n            pattern: "(?i)^${p.jenkinsFolder}/(${alt})(%2F|/).*$"\n            permissions: ["Job/Read", "Job/Discover"]\n            entries:\n              - user: "${d.user}"\n`;
    }
  }
  const files = reg.projects.map((p) => `      - custom:\n          id: "${p.id}-central-jenkinsfile"\n          name: "${p.displayName} central Jenkinsfile"\n          comment: "Used for every branch without its own Jenkinsfile. Identical to the repository Jenkinsfile (enforced by a test)."\n          content: "\${readFile:/usr/share/jenkins/ref/casc/${p.centralJenkinsfile}}"\n`).join("");
  let t = text;
  t = region(t, "users", users, "        ", "#");
  t = region(t, "admins", admins, "              ", "#");
  t = region(t, "roles", roles, "          ", "#");
  t = region(t, "configfiles", files, "      ", "#");
  return t;
}

const JOBS_HEAD = "jobs:\n  - script: |\n";
const JOB_TEMPLATE = (list) => `${JOBS_HEAD}      // >>> generated:projects (from ci/projects.json: do not edit by hand)
${list}      // <<< generated:projects
      PROJECTS.each { p ->
        multibranchPipelineJob(p.folder) {
          displayName(p.display)
          branchSources {
            github {
              id(p.id + '-github')
              repoOwner(p.owner)
              repository(p.repo)
              scanCredentialsId('taskflow-github-read')
              // Discovery only. Pull requests from forks are NOT built: they could run hostile code.
              buildOriginBranch(true)          // branches without a pull request
              buildOriginBranchWithPR(true)    // a branch that has a PR is built AS THE BRANCH, so the job keeps the branch name (a "PR-12" job names no owner, so per-developer visibility is impossible)
              buildOriginPRHead(false)         // no separate PR job: the status is stored on the commit, so the pull request shows it exactly as before
            }
          }
          // CENTRAL PIPELINE: branches need no Jenkinsfile. The one stored in Jenkins (config file below) is used for every
          // branch that has none; the gate refuses to sign a branch whose own Jenkinsfile differs from the admin-approved pin.
          configure { node ->
            def f = node / 'factory'
            f.@class = 'org.jenkinsci.plugins.pipeline.multibranch.defaults.PipelineBranchDefaultsProjectFactory'
            f.children().clear()
            f / 'scriptId'(p.id + '-central-jenkinsfile')
            f / 'useSandbox'(true)
          }
          // Optional per-project branch filter: only main and the branches of the project's developers are discovered, so onboarding a repository with many old branches does not build all of them.
          if (p.branchRegex) {
            configure { node ->
              def traits = node / 'sources' / 'data' / 'jenkins.branch.BranchSource' / 'source' / 'traits'
              traits << 'jenkins.scm.impl.trait.RegexSCMHeadFilterTrait' { regex(p.branchRegex) }
            }
          }
          orphanedItemStrategy { discardOldItems { numToKeep(10) } }
          // No periodic trigger here: the gate asks for a scan on every verified webhook and on a timer (recovery path).
        }
      }
`;

export function renderGithubYaml(text, reg) {
  const list = "      def PROJECTS = [\n" + reg.projects.map((p) => { const [owner, repo] = p.repo.split("/"); const br = branchRegexFor(p); return `        [id: '${p.id}', folder: '${p.jenkinsFolder}', display: '${p.displayName.replace(/'/g, "")}', owner: '${owner}', repo: '${repo}'${br ? `, branchRegex: '${br}'` : ""}],\n`; }).join("") + "      ]\n";
  const rx = /jobs:\n {2}- script: \|\n[\s\S]*?(?=\n {2}# Production health check)/;
  if (!rx.test(text)) throw new Error("github.yaml: the jobs block was not found");
  return text.replace(rx, () => JOB_TEMPLATE(list));
}

const eol = (raw) => (raw.includes("\r\n") ? "\r\n" : "\n");
const read = (p) => { const raw = fs.readFileSync(p, "utf8"); return { raw, text: raw.replace(/\r\n/g, "\n") }; };

export function generateAll({ registryFile = path.join(HERE, "..", "projects.json"), casc = path.join(HERE, "casc"), write = false } = {}) {
  const reg = loadRegistry(registryFile);
  const out = [];
  for (const [file, render] of [["jenkins.yaml", renderJenkinsYaml], ["github.yaml", renderGithubYaml]]) {
    const f = path.join(casc, file), { raw, text } = read(f);
    const next = render(text, reg);
    const final = eol(raw) === "\r\n" ? next.replace(/\n/g, "\r\n") : next;
    out.push({ file, changed: final !== raw });
    if (write && final !== raw) fs.writeFileSync(f, final);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const check = process.argv.includes("--check");
  const res = generateAll({ write: !check });
  const drift = res.filter((r) => r.changed);
  if (check) { if (drift.length) { console.error(`✘ out of date with ci/projects.json: ${drift.map((d) => d.file).join(", ")} (run: node ci/jenkins/generate.mjs)`); process.exit(1); } console.log("✔ Jenkins config matches ci/projects.json"); }
  else console.log(drift.length ? `✔ regenerated: ${drift.map((d) => d.file).join(", ")}` : "✔ already up to date");
}
