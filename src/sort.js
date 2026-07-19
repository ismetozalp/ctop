const KEYS = {
  pid: (r) => r.pid, threads: (r) => r.threads, memory: (r) => r.rss, cpu: (r) => r.cpu,
  program: (r) => r.program, user: (r) => r.user,
};
export function sortProcs(list, key, reversed) {
  const get = KEYS[key] || KEYS.cpu;
  const numeric = key !== "program" && key !== "user";
  const sorted = list.slice().sort((a, b) => {
    const av = get(a), bv = get(b);
    if (numeric) return bv - av;            // numeric: descending (biggest first)
    return String(av).localeCompare(String(bv)); // text: ascending
  });
  return reversed ? sorted.reverse() : sorted;
}
