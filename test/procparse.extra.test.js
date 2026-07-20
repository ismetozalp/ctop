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

import { isKernelThread } from "../src/procparse.js";
test("isKernelThread: bracketed / empty commands are kernel threads", () => {
  assert.equal(isKernelThread("[kworker/0:1-events]"), true);
  assert.equal(isKernelThread("[xfsaild/dm-0]"), true);
  assert.equal(isKernelThread("  [kthreadd]  "), true);
  assert.equal(isKernelThread(""), true);
  assert.equal(isKernelThread(null), true);
  assert.equal(isKernelThread(undefined), true);
});
test("isKernelThread: real command lines are not", () => {
  assert.equal(isKernelThread("/usr/sbin/nginx -g 'daemon off;'"), false);
  assert.equal(isKernelThread("node server.js"), false);
  assert.equal(isKernelThread("/sbin/init"), false);
  assert.equal(isKernelThread("[not-closed"), false);
});
