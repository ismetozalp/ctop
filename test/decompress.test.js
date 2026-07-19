import test from "node:test";
import assert from "node:assert/strict";
import { Decompressor } from "../src/decompress.js";

test("first sample passes through, nulls carry forward", () => {
  const d = new Decompressor();
  const out1 = d.feed([[10, [1, 2]]]);
  assert.deepEqual(out1, [[10, [1, 2]]]);
  const out2 = d.feed([[null, [null, 5]]]);
  assert.deepEqual(out2, [[10, [1, 5]]]); // 10 carried, 1 carried, 2->5
});
test("carries across messages and multiple samples", () => {
  const d = new Decompressor();
  d.feed([[3, [7]]]);
  const out = d.feed([[null, [null]], [4, [null]]]);
  assert.deepEqual(out, [[3, [7]], [4, [7]]]);
});
