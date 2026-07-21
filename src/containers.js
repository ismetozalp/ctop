// src/containers.js — pure container-engine helpers for the containers box.
// podman and docker share the same `stats` Go-template CLI, so one descriptor
// list + one parser serves both. No cockpit/DOM references (unit-testable).

const STATS_FORMAT = "{{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}";

export const ENGINES = [
  { id: "podman" },
  { id: "docker" },
];

export function statsArgs(engine) {
  return [engine.id, "stats", "--no-stream", "--format", STATS_FORMAT];
}

// One engine's `stats` output -> [{engine, id, name, cpu, mem, net}]
export function parseStats(out, engineId) {
  if (!out) return [];
  return out.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split("\t");
    return { engine: engineId, id: parts[0] || "", name: parts[1] || "", cpu: parts[2] || "", mem: parts[3] || "", net: parts[4] || "" };
  });
}

// Merge per-engine row lists into one table, de-duplicated by container ID and
// sorted by name. The podman-docker shim (docker == podman) reports the same
// containers under both engines with identical IDs; keeping the first occurrence
// collapses those duplicates, while genuinely separate podman/docker daemons
// have distinct IDs and both survive.
export function mergeRows(lists) {
  const seen = new Set();
  const out = [];
  for (const row of lists.flat()) {
    const key = row.id || (row.engine + ":" + row.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
