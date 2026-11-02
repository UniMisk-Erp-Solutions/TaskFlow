// The project registry (ci/projects.json): which repositories this one Jenkins and one gate serve.
// Used by the gate (one verification pipeline per project), the Jenkins config generator and the bootstrap tool, so a
// project is described exactly once. Validation is strict: a typo here would otherwise become a silent hole.
import fs from "node:fs";

const ID_RE = /^[a-z][a-z0-9-]{1,30}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FOLDER_RE = /^[a-z][a-z0-9-]{1,30}$/;
const USER_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const PREFIX_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/;
const CHECK_RE = /^[a-z][a-z0-9-]*$/;
const FILE_RE = /^[A-Za-z0-9._/-]+$/;

export function parseRegistry(json) {
  const fail = (m) => { throw new Error(`projects.json: ${m}`); };
  if (!json || typeof json !== "object" || !Array.isArray(json.projects) || json.projects.length === 0) fail("needs a non-empty projects list");
  const admins = json.admins ?? [];
  if (!Array.isArray(admins) || admins.some((a) => !USER_RE.test(a))) fail("admins must be a list of valid user names");
  // ONE team list for every project: a person is described once (GitHub user + branch prefixes), and a project either takes the whole team
  // (developers left out or "all"), a named subset (["alice","bob"]), or - older style - its own full entries.
  const parseDev = (d, where) => {
    if (!USER_RE.test(d?.user || "")) fail(`${where}: invalid developer user ${JSON.stringify(d?.user)}`);
    if (!Array.isArray(d.prefixes) || d.prefixes.length === 0 || d.prefixes.some((x) => !PREFIX_RE.test(x))) fail(`${where}/${d.user}: prefixes must be a non-empty list of plain names`);
    return { user: d.user, prefixes: [...new Set(d.prefixes)] };
  };
  if (json.developers !== undefined && !Array.isArray(json.developers)) fail("developers (the team list) must be a list");
  const team = (json.developers ?? []).map((d) => parseDev(d, "team"));
  if (new Set(team.map((d) => d.user.toLowerCase())).size !== team.length) fail("team: a developer is listed twice");
  if (team.some((d) => admins.includes(d.user))) fail("team: an admin cannot also be listed as a branch developer");
  const seen = { id: new Set(), repo: new Set(), folder: new Set() };
  const projects = json.projects.map((p, i) => {
    const at = `projects[${i}]`;
    if (!p || typeof p !== "object") fail(`${at} is not an object`);
    if (!ID_RE.test(p.id || "")) fail(`${at}.id must be lowercase letters, digits and dashes`);
    if (!REPO_RE.test(p.repo || "")) fail(`${p.id}: repo must look like owner/name`);
    if (!FOLDER_RE.test(p.jenkinsFolder || "")) fail(`${p.id}: jenkinsFolder must be lowercase letters, digits and dashes`);
    for (const [k, v] of [["id", p.id], ["repo", p.repo.toLowerCase()], ["folder", p.jenkinsFolder]]) { if (seen[k].has(v)) fail(`duplicate ${k}: ${v}`); seen[k].add(v); }
    const central = p.centralJenkinsfile ?? `projects/${p.id}/Jenkinsfile`;
    if (!FILE_RE.test(central) || central.includes("..") || central.startsWith("/")) fail(`${p.id}: centralJenkinsfile must be a plain relative path`);
    let devs;
    if (p.developers === undefined || p.developers === "all") devs = team;
    else if (Array.isArray(p.developers) && p.developers.every((d) => typeof d === "string")) {
      devs = p.developers.map((u) => team.find((t) => t.user.toLowerCase() === u.toLowerCase()) ?? fail(`${p.id}: developer "${u}" is not in the team list`));
    } else if (Array.isArray(p.developers)) devs = p.developers.map((d) => parseDev(d, p.id));
    else fail(`${p.id}: developers must be "all", a list of team user names, or a list of full entries`);
    if (new Set(devs.map((d) => d.user.toLowerCase())).size !== devs.length) fail(`${p.id}: a developer is listed twice`);
    if (devs.some((d) => admins.includes(d.user))) fail(`${p.id}: an admin cannot also be listed as a branch developer`);
    if (p.branchFilter !== undefined && p.branchFilter !== "developers") fail(`${p.id}: branchFilter must be "developers" (build main and the branches of the listed developers only) or left out (build every branch)`);
    if (p.requiredChecks !== undefined && (!Array.isArray(p.requiredChecks) || p.requiredChecks.length === 0 || p.requiredChecks.some((c) => !CHECK_RE.test(c)) || new Set(p.requiredChecks).size !== p.requiredChecks.length)) fail(`${p.id}: requiredChecks must be a non-empty list of unique stage names`);
    return { id: p.id, displayName: p.displayName || p.id, repo: p.repo, jenkinsFolder: p.jenkinsFolder, centralJenkinsfile: central, developers: devs, requiredChecks: p.requiredChecks, branchFilter: p.branchFilter };
  });
  const defaultProject = json.defaultProject ?? projects[0].id;
  if (!seen.id.has(defaultProject)) fail(`defaultProject "${defaultProject}" is not in the list`);
  for (const p of projects) if (p.id !== defaultProject && !p.requiredChecks) fail(`${p.id}: requiredChecks is required (only the default project may use the built-in list)`);
  return { defaultProject, admins, projects };
}

export function loadRegistry(file) { return parseRegistry(JSON.parse(fs.readFileSync(file, "utf8"))); }

/** The single-project setup used before the registry existed: everything comes from environment variables. */
export function legacyRegistry(env) {
  return parseRegistry({ defaultProject: "taskflow", projects: [{ id: "taskflow", repo: env.GATE_REPO, jenkinsFolder: env.GATE_JENKINS_FOLDER || "taskflow" }] });
}
