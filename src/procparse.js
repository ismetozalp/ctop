// A process with no command line — ps shows its name in [brackets], or it is
// empty — has no working directory (kernel threads like kworker/…, zombies).
export function isKernelThread(command) {
  const c = String(command || "").trim();
  return c === "" || (c.startsWith("[") && c.endsWith("]"));
}

export function parsePs(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    // 7 fixed fields then the rest is args (may be empty)
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+([\d.]+)\s+(\S+)(?:\s+(.*))?$/);
    if (!m) continue;
    out.push({
      pid: +m[1], ppid: +m[2], threads: +m[3], user: m[4],
      rss: +m[5] * 1024, cpu: parseFloat(m[6]), program: m[7], command: m[8] || "",
    });
  }
  return out;
}
