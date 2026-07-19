import test from "node:test";
import assert from "node:assert/strict";
import { humanize } from "../src/humanize.js";

test("bytes binary", () => {
  assert.equal(humanize(0), "0 B");
  assert.equal(humanize(512), "512 B");
  assert.equal(humanize(1024), "1.00 KiB");
  assert.equal(humanize(1536), "1.50 KiB");
  assert.equal(humanize(1048576), "1.00 MiB");
});
test("bits multiply by 8", () => {
  assert.equal(humanize(1024, { bit: true }), "8.00 Kib");
});
test("per second suffix", () => {
  assert.equal(humanize(1048576, { perSecond: true }), "1.00 MiB/s");
});
test("base10 uses decimal units", () => {
  assert.equal(humanize(1000, { base10: true }), "1.00 kB");
});
test("large value drops fraction above 10", () => {
  assert.equal(humanize(15 * 1048576), "15.0 MiB");
});
