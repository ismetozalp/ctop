import test from "node:test";
import assert from "node:assert/strict";
import { sortProcs } from "../src/sort.js";

const rows = [
  { pid: 1, program: "b", threads: 2, user: "root", rss: 10, cpu: 5 },
  { pid: 2, program: "a", threads: 9, user: "ismet", rss: 30, cpu: 1 },
];
test("cpu desc by default", () => {
  assert.deepEqual(sortProcs(rows, "cpu", false).map((r) => r.pid), [1, 2]);
});
test("memory desc", () => {
  assert.deepEqual(sortProcs(rows, "memory", false).map((r) => r.pid), [2, 1]);
});
test("program asc alpha, reversed flips", () => {
  assert.deepEqual(sortProcs(rows, "program", false).map((r) => r.pid), [2, 1]);
  assert.deepEqual(sortProcs(rows, "program", true).map((r) => r.pid), [1, 2]);
});
