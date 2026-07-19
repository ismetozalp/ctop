import test from "node:test";
import assert from "node:assert/strict";
import { sortProcs } from "../src/sort.js";
const rows = [
  { pid: 1, program: "b", threads: 2, user: "root", rss: 10, cpu: 5 },
  { pid: 2, program: "a", threads: 9, user: "alice", rss: 30, cpu: 1 },
  { pid: 3, program: "c", threads: 1, user: "ismet", rss: 20, cpu: 9 },
];
test("user key sorts ascending", () => {
  assert.deepEqual(sortProcs(rows, "user", false).map((r) => r.user), ["alice", "ismet", "root"]);
});
test("unknown key falls back to cpu desc", () => {
  assert.deepEqual(sortProcs(rows, "bogus", false).map((r) => r.pid), [3, 1, 2]);
});
test("reversed flips text sort", () => {
  assert.deepEqual(sortProcs(rows, "user", true).map((r) => r.user), ["root", "ismet", "alice"]);
});
test("does not mutate input", () => {
  const before = rows.map((r) => r.pid);
  sortProcs(rows, "cpu", false);
  assert.deepEqual(rows.map((r) => r.pid), before);
});
