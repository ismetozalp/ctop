import test from "node:test";
import assert from "node:assert/strict";
import { Decompressor } from "../src/decompress.js";

test("a real 0 is not treated as unchanged", () => {
  const d = new Decompressor();
  d.feed([[5]]);
  assert.deepEqual(d.feed([[0]]), [[0]]); // 0 overwrites, not carried
});
test("nested array that grows fills new index from cur", () => {
  const d = new Decompressor();
  d.feed([[[1, 2]]]);
  assert.deepEqual(d.feed([[[null, null, 7]]]), [[[1, 2, 7]]]);
});
