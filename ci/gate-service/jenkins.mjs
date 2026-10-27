// Minimal Jenkins REST client for the gate. It uses a dedicated low-privilege user (read jobs, start builds) and
// never reads credentials, configuration or the script console.
export function createJenkinsClient({ baseUrl, user, password, folder, fetchImpl = fetch, timeoutMs = 15000 }) {
  const root = baseUrl.replace(/\/+$/, "");
  const auth = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  const call = (path, init = {}) => fetchImpl(`${root}${path}`, { ...init, headers: { authorization: auth, ...(init.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) });
  // Jenkins reports absolute URLs built from its configured root URL (not reachable from this container): keep only the path.
  const pathOf = (u) => new URL(u, "http://x").pathname;

  async function crumb() {
    const res = await call("/crumbIssuer/api/json");
    if (!res.ok) throw new Error(`crumb: HTTP ${res.status}`);
    const j = await res.json();
    return { header: { [j.crumbRequestField]: j.crumb }, cookie: res.headers.get("set-cookie")?.split(";")[0] };
  }

  return {
    /** "Scan Repository Now": Jenkins asks GitHub (or the local clone) for branches/PR heads and builds the new commits. */
    async triggerScan() {
      const c = await crumb();
      const res = await call(`/job/${encodeURIComponent(folder)}/build?delay=0`, { method: "POST", redirect: "manual", headers: { ...c.header, ...(c.cookie ? { cookie: c.cookie } : {}) } });
      if (res.status >= 400) throw new Error(`scan: HTTP ${res.status}`);
      return { status: res.status };
    },

    /** Recent builds of every branch/PR job under the multibranch folder, with the commit Jenkins itself checked out. */
    async listBuilds() {
      const tree = "jobs[name,builds[number,url,building,result,timestamp,actions[lastBuiltRevision[SHA1]]]{0,15}]";
      const res = await call(`/job/${encodeURIComponent(folder)}/api/json?tree=${encodeURIComponent(tree)}`);
      if (!res.ok) throw new Error(`list builds: HTTP ${res.status}`);
      const data = await res.json();
      const out = [];
      for (const job of data.jobs || []) {
        for (const b of job.builds || []) {
          const sha = (b.actions || []).map((a) => a?.lastBuiltRevision?.SHA1).find(Boolean) || null;
          out.push({ folder, job: decodeURIComponent(job.name), number: b.number, building: !!b.building, result: b.result || null, timestamp: b.timestamp, path: pathOf(b.url), sha });
        }
      }
      return out;
    },

    /** An archived JSON artifact of a build, or null when it does not exist / is not JSON. */
    async artifactJson(buildPath, rel) {
      const res = await call(`${buildPath}artifact/${rel}`);
      if (!res.ok) return null;
      try { return await res.json(); } catch { return null; }
    },
  };
}
