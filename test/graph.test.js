import test from "node:test";
import assert from "node:assert/strict";
import { quantize } from "../src/graph.js";

test("all 100 fills every dot", () => {
  const g = quantize([100, 100, 100, 100], 2, 1);
  assert.deepEqual(g, [[[4, 4], [4, 4]]]);
});
test("all 0 empties every dot", () => {
  const g = quantize([0, 0, 0, 0], 2, 1);
  assert.deepEqual(g, [[[0, 0], [0, 0]]]);
});
test("mid value quantizes within a single band", () => {
  // height 1 band [0,100]; value 50 -> round(50*4/100 + 0.3) = round(2.3) = 2
  const g = quantize([50, 50], 1, 1);
  assert.deepEqual(g, [[[2, 2]]]);
});
test("uses newest 2*width samples, older dropped", () => {
  const g = quantize([0, 0, 100, 100], 1, 1);
  assert.deepEqual(g, [[[4, 4]]]); // only last two (100,100) kept
});
test("front-pads with zeros when short", () => {
  const g = quantize([100], 1, 1);
  assert.deepEqual(g, [[[0, 4]]]); // padded left sample 0, right sample 100
});
test("noZero keeps baseline at level 1", () => {
  const g = quantize([0, 0], 1, 1, { noZero: true });
  assert.deepEqual(g, [[[1, 1]]]);
});
test("two-row graph splits into bands", () => {
  // height 2: row0 band [50,100], row1 band [0,50]; value 100 -> row0=4,row1=4
  const g = quantize([100, 100], 1, 2);
  assert.deepEqual(g, [[[4, 4]], [[4, 4]]]);
});
