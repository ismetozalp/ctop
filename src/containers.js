// src/containers.js — pure container-engine helpers for the containers box.
// podman and docker share the same `stats` Go-template CLI, so one descriptor
// list + one parser serves both. No cockpit/DOM references (unit-testable).

const STATS_FORMAT = "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}";

export const ENGINES = [
  { id: "podman" },
  { id: "docker" },
];

export function statsArgs(engine) {
  return [engine.id, "stats", "--no-stream", "--format", STATS_FORMAT];
}

// One engine's `stats` output -> [{engine, name, cpu, mem, net}]
export function parseStats(out, engineId) {
  if (!out) return [];
  return out.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split("\t");
    return { engine: engineId, name: parts[0] || "", cpu: parts[1] || "", mem: parts[2] || "", net: parts[3] || "" };
  });
}

// Merge per-engine row lists into one table, sorted by container name.
export function mergeRows(lists) {
  return lists.flat().sort((a, b) => a.name.localeCompare(b.name));
}
