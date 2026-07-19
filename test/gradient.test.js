// test/gradient.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { hexToRgb, rgbToHex, buildGradient } from "../src/gradient.js";

test("hexToRgb parses 6-digit", () => {
  assert.deepEqual(hexToRgb("#77ca9b"), [0x77, 0xca, 0x9b]);
});
test("hexToRgb parses 2-digit grayscale", () => {
  assert.deepEqual(hexToRgb("#cc"), [0xcc, 0xcc, 0xcc]);
});
test("gradient has 101 stops, endpoints exact", () => {
  const g = buildGradient("#77ca9b", "#cbc06c", "#dc4c4c");
  assert.equal(g.length, 101);
  assert.equal(g[0], "#77ca9b");
  assert.equal(g[100], "#dc4c4c");
  assert.equal(g[50], "#cbc06c");
});
test("gradient without mid interpolates start->end over 0..100", () => {
  const g = buildGradient("#000000", null, "#ffffff");
  assert.equal(g[0], "#000000");
  assert.equal(g[50], rgbToHex([128, 128, 128]));
  assert.equal(g[100], "#ffffff");
});
test("gradient with only start is flat", () => {
  const g = buildGradient("#123456", null, null);
  assert.equal(g[0], "#123456");
  assert.equal(g[100], "#123456");
});
