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
    assert.match(argv[argv.length - 1], /\{\{\.ID\}\}\t\{\{\.Name\}\}\t\{\{\.CPUPerc\}\}\t\{\{\.MemUsage\}\}\t\{\{\.NetIO\}\}/);
  }
});

test("parseStats parses id + tab-separated rows and tags the engine", () => {
  const out = "abc123\tweb\t1.23%\t100MiB / 2GiB\t1kB / 2kB\ndef456\tdb\t0.00%\t50MiB / 2GiB\t0B / 0B\n";
  const rows = parseStats(out, "docker");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { engine: "docker", id: "abc123", name: "web", cpu: "1.23%", mem: "100MiB / 2GiB", net: "1kB / 2kB" });
  assert.deepEqual(rows[1], { engine: "docker", id: "def456", name: "db", cpu: "0.00%", mem: "50MiB / 2GiB", net: "0B / 0B" });
});

test("parseStats tolerates blank lines, whitespace, and missing fields", () => {
  const rows = parseStats("  \n\nonly-id\nx\ta\tb\tc\td\n", "podman");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { engine: "podman", id: "only-id", name: "", cpu: "", mem: "", net: "" });
  assert.deepEqual(rows[1], { engine: "podman", id: "x", name: "a", cpu: "b", mem: "c", net: "d" });
});

test("parseStats of null/empty output is an empty list", () => {
  assert.deepEqual(parseStats("", "docker"), []);
  assert.deepEqual(parseStats(null, "docker"), []);
});

test("mergeRows flattens, de-dups by id, and sorts by name", () => {
  const podman = parseStats("i3\tzeta\t1%\tm\tn\ni1\talpha\t2%\tm\tn\n", "podman");
  const docker = parseStats("i2\tbeta\t3%\tm\tn\n", "docker");
  const merged = mergeRows([podman, docker]);
  assert.deepEqual(merged.map((r) => r.name), ["alpha", "beta", "zeta"]);
  assert.deepEqual(merged.map((r) => r.engine), ["podman", "docker", "podman"]);
});

test("mergeRows collapses the podman-docker shim (same IDs) to one row each", () => {
  // podman and the docker shim report identical containers with identical IDs
  const podman = parseStats("f991\tmongodb\t13%\tm\tn\n82b7\tkafka\t37%\tm\tn\n", "podman");
  const docker = parseStats("f991\tmongodb\t13%\tm\tn\n82b7\tkafka\t37%\tm\tn\n", "docker");
  const merged = mergeRows([podman, docker]);
  assert.deepEqual(merged.map((r) => r.name), ["kafka", "mongodb"]); // each once
  assert.deepEqual(merged.map((r) => r.engine), ["podman", "podman"]); // first (podman) kept
  assert.equal(new Set(merged.map((r) => r.engine)).size, 1); // -> engine column stays hidden
});

test("mergeRows keeps genuinely distinct containers that share a name (different IDs)", () => {
  const podman = parseStats("aaa\tapp\t1%\tm\tn\n", "podman");
  const docker = parseStats("bbb\tapp\t2%\tm\tn\n", "docker");
  const merged = mergeRows([podman, docker]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((r) => r.engine).sort(), ["docker", "podman"]);
});

test("mergeRows with one engine or empty lists", () => {
  assert.deepEqual(mergeRows([]), []);
  assert.deepEqual(mergeRows([[], []]), []);
  const one = parseStats("id1\ta\t1%\tm\tn\n", "docker");
  assert.equal(mergeRows([[], one]).length, 1);
});
