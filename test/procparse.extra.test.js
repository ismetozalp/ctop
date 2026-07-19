import test from "node:test";
import assert from "node:assert/strict";
import { parsePs } from "../src/procparse.js";

test("malformed lines are dropped, valid ones parsed", () => {
  const list = parsePs("garbage nonsense line\n1 0 1 root 100 0.5 init /sbin/init");
  assert.equal(list.length, 1);
  assert.equal(list[0].program, "init");
  assert.equal(list[0].command, "/sbin/init");
});
test("blank/whitespace lines ignored", () => {
  assert.equal(parsePs("\n   \n").length, 0);
});
test("float cpu and rss->bytes", () => {
  const [p] = parsePs("42 1 3 alice 2048 12.5 bash");
  assert.equal(p.cpu, 12.5);
  assert.equal(p.rss, 2048 * 1024);
  assert.equal(p.command, "");
});
