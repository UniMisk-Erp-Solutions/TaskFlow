// Small durable state (JSON on a volume) so a restart neither forgets what it published nor re-processes old builds.
import fs from "node:fs";
import path from "node:path";

const MAX_DELIVERIES = 5000;
const DELIVERY_TTL_MS = 24 * 3600_000;

export function createState(file, now = () => Date.now()) {
  let s = { deliveries: {}, builds: {}, statuses: {}, scans: { count: 0, last: null } };
  try { s = { ...s, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch { /* first start */ }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s));
    fs.renameSync(tmp, file);
  };
  return {
    data: s,
    save,
    /** Records a delivery id; returns true if it was already seen within the last 24 h. */
    seenDelivery(id) {
      const t = now();
      for (const [k, v] of Object.entries(s.deliveries)) if (t - v > DELIVERY_TTL_MS) delete s.deliveries[k];
      if (s.deliveries[id]) return true;
      s.deliveries[id] = t;
      const keys = Object.keys(s.deliveries);
      if (keys.length > MAX_DELIVERIES) for (const k of keys.slice(0, keys.length - MAX_DELIVERIES)) delete s.deliveries[k];
      save();
      return false;
    },
  };
}
