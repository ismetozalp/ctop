import test from "node:test";
import assert from "node:assert/strict";
import { ENGINES, statsArgs, parseStats, mergeRows } from "../src/containers.js";

test("ENGINES lists podman and docker", () => {
  assert.deepEqual(ENGINES.map((e) => e.id), ["podman", "docker"]);
});

test("statsArgs builds the same stats format for every engine", () => {
  for (const e of ENGINES) {
    const argv = statsArgs(e);
    assert.equal(argv[0], e.id);
    assert.deepEqual(argv.slice(1, 3), ["stats", "--no-stream"]);
    assert.ok(argv.includes("--format"));
    assert.match(argv[argv.length - 1], /\{\{\.Name\}\}\t\{\{\.CPUPerc\}\}\t\{\{\.MemUsage\}\}\t\{\{\.NetIO\}\}/);
  }
});

test("parseStats parses tab-separated rows and tags the engine", () => {
  const out = "web\t1.23%\t100MiB / 2GiB\t1kB / 2kB\ndb\t0.00%\t50MiB / 2GiB\t0B / 0B\n";
  const rows = parseStats(out, "docker");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { engine: "docker", name: "web", cpu: "1.23%", mem: "100MiB / 2GiB", net: "1kB / 2kB" });
  assert.deepEqual(rows[1], { engine: "docker", name: "db", cpu: "0.00%", mem: "50MiB / 2GiB", net: "0B / 0B" });
});

test("parseStats tolerates blank lines, whitespace, and missing fields", () => {
  const rows = parseStats("  \n\nonly-name\na\tb\tc\td\n", "podman");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { engine: "podman", name: "only-name", cpu: "", mem: "", net: "" });
  assert.deepEqual(rows[1], { engine: "podman", name: "a", cpu: "b", mem: "c", net: "d" });
});

test("parseStats of null/empty output is an empty list", () => {
  assert.deepEqual(parseStats("", "docker"), []);
  assert.deepEqual(parseStats(null, "docker"), []);
});

test("mergeRows flattens and sorts by name", () => {
  const podman = parseStats("zeta\t1%\tm\tn\nalpha\t2%\tm\tn\n", "podman");
  const docker = parseStats("beta\t3%\tm\tn\n", "docker");
  const merged = mergeRows([podman, docker]);
  assert.deepEqual(merged.map((r) => r.name), ["alpha", "beta", "zeta"]);
  assert.deepEqual(merged.map((r) => r.engine), ["podman", "docker", "podman"]);
});

test("mergeRows with one engine or empty lists", () => {
  assert.deepEqual(mergeRows([]), []);
  assert.deepEqual(mergeRows([[], []]), []);
  const one = parseStats("a\t1%\tm\tn\n", "docker");
  assert.equal(mergeRows([[], one]).length, 1);
});
