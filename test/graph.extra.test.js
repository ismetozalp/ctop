import test from "node:test";
import assert from "node:assert/strict";
import { quantize } from "../src/graph.js";

test("maxValue scales samples", () => {
  // 500 of 1000 -> 50%; height1 band[0,100]: round(50*4/100+0.3)=2
  assert.deepEqual(quantize([500], 1, 1, { maxValue: 1000 }), [[[0, 2]]]);
});
test("offset shifts before scaling", () => {
  // both samples (0+50)/100 -> 50% -> level 2 (no padding: two samples given)
  assert.deepEqual(quantize([0, 0], 1, 1, { maxValue: 100, offset: 50 }), [[[2, 2]]]);
});
test("width 2 keeps per-cell/per-sample independence", () => {
  // newest 4 samples [100,0,100,0] -> c0=[100,0]->[4,0], c1=[100,0]->[4,0]
  assert.deepEqual(quantize([100, 0, 100, 0], 2, 1), [[[4, 0], [4, 0]]]);
});
test("value above maxValue clamps to full", () => {
  assert.deepEqual(quantize([9999], 1, 1, { maxValue: 100 }), [[[0, 4]]]);
});
