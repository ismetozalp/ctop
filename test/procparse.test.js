import test from "node:test";
import assert from "node:assert/strict";
import { parsePs } from "../src/procparse.js";

test("parses a ps line", () => {
  const line = "  1234     1    5 ismet                2048  12.5 node            /usr/bin/node server.js";
  const [p] = parsePs(line);
  assert.equal(p.pid, 1234);
  assert.equal(p.ppid, 1);
  assert.equal(p.threads, 5);
  assert.equal(p.user, "ismet");
  assert.equal(p.rss, 2048 * 1024);
  assert.equal(p.cpu, 12.5);
  assert.equal(p.program, "node");
  assert.equal(p.command, "/usr/bin/node server.js");
});
test("handles empty command and multiple lines", () => {
  const text = "1 0 1 root 100 0.0 systemd /sbin/init\n2 0 1 root 0 0.0 kthreadd ";
  const list = parsePs(text);
  assert.equal(list.length, 2);
  assert.equal(list[1].command, "");
});
