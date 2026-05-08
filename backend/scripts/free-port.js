const { execSync } = require("child_process");

function getPort() {
  const fromEnv = Number(process.env.PORT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 5001;
}

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
}

function main() {
  const port = getPort();

  // Windows netstat output includes the owning PID in the last column.
  // Example: TCP 0.0.0.0:5001 0.0.0.0:0 LISTENING 26108
  let out = "";
  try {
    out = run(`netstat -ano | findstr :${port}`);
  } catch {
    // Nothing is listening on that port
    process.exit(0);
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("LISTENING")) continue;
    const parts = trimmed.split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  if (pids.size === 0) process.exit(0);

  for (const pid of pids) {
    try {
      // Force kill to avoid EADDRINUSE loops
      run(`taskkill /PID ${pid} /F`);
      // eslint-disable-next-line no-console
      console.log(`[free-port] Killed PID ${pid} on port ${port}`);
    } catch {
      // ignore
    }
  }
}

main();

