import test from "node:test";
import assert from "node:assert/strict";
import { theme } from "../src/theme.js";

test("cpu gradient endpoints match btop Default", () => {
  assert.equal(theme.gradients.cpu[0], "#77ca9b");
  assert.equal(theme.gradients.cpu[50], "#cbc06c");
  assert.equal(theme.gradients.cpu[100], "#dc4c4c");
});
test("all expected gradients exist with 101 stops", () => {
  for (const k of ["cpu","temp","used","cached","available","free","download","upload","process"])
    assert.equal(theme.gradients[k].length, 101, k);
});
test("base colors present", () => {
  assert.equal(theme.colors.cpu_box, "#556d59");
  assert.equal(theme.colors.meter_bg, "#404040");
});
