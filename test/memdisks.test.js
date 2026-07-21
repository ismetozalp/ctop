import test from "node:test";
import assert from "node:assert/strict";
import { visibleDisks } from "../src/boxes/memBox.js";

const DEVS = ["nvme1n1", "loop0", "sda", "loop12", "loop-control-ish", "nvme0n1"];

test("visibleDisks hides loopN devices by default", () => {
  assert.deepEqual(visibleDisks(DEVS, false), ["nvme1n1", "sda", "loop-control-ish", "nvme0n1"]);
});

test("visibleDisks keeps everything when showLoops is on", () => {
  assert.deepEqual(visibleDisks(DEVS, true), DEVS);
});

test("visibleDisks only matches whole loopN names", () => {
  assert.deepEqual(visibleDisks(["looper", "loop", "loop7x", "loop7"], false), ["looper", "loop", "loop7x"]);
});

test("visibleDisks of empty list", () => {
  assert.deepEqual(visibleDisks([], false), []);
});
