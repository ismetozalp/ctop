import test from "node:test";
import assert from "node:assert/strict";
import { humanize } from "../src/humanize.js";

test(">=100 in a unit rounds to integer", () => {
  assert.equal(humanize(150 * 1024), "150 KiB");
  assert.equal(humanize(100 * 1024), "100 KiB");
});
test("[10,100) keeps one decimal", () => {
  assert.equal(humanize(10 * 1024), "10.0 KiB");
});
test("base10 decimal ladder", () => {
  assert.equal(humanize(1000 * 1000, { base10: true }), "1.00 MB");
});
test("climbs to PiB", () => {
  assert.equal(humanize(5 * (1024 ** 5)), "5.00 PiB");
});
test("bits per second", () => {
  assert.equal(humanize(1024, { bit: true, perSecond: true }), "8.00 Kib/s");
});
