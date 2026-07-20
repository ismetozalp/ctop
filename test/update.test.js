import test from "node:test";
import assert from "node:assert/strict";
import { versionTuple, isNewer, normalizeRepo } from "../src/update.js";

test("versionTuple strips leading v and parses", () => {
  assert.deepEqual(versionTuple("v1.2.3"), [1, 2, 3]);
  assert.deepEqual(versionTuple("0.1.0"), [0, 1, 0]);
});
test("isNewer compares semantically", () => {
  assert.equal(isNewer("0.2.0", "0.1.9"), true);
  assert.equal(isNewer("1.0.0", "0.9.9"), true);
  assert.equal(isNewer("0.1.0", "0.1.0"), false);
  assert.equal(isNewer("0.1.0", "0.1.1"), false);
  assert.equal(isNewer("v0.1.2", "0.1.1"), true); // tolerates v prefix
});
test("normalizeRepo accepts owner/repo and github URLs", () => {
  assert.equal(normalizeRepo("ismetozalp/ctop"), "ismetozalp/ctop");
  assert.equal(normalizeRepo("https://github.com/ismetozalp/ctop.git"), "ismetozalp/ctop");
  assert.equal(normalizeRepo("git@github.com:ismetozalp/ctop"), "ismetozalp/ctop");
  assert.equal(normalizeRepo("https://github.com/ismetozalp/ctop/"), "ismetozalp/ctop");
});
