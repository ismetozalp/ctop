import test from "node:test";
import assert from "node:assert/strict";
import { theme } from "../src/theme.js";

test("loadThemeText mutates gradient arrays in place (same ref)", () => {
  const ref = theme.gradients.cpu;
  theme.loadThemeText('theme[cpu_start]="#111111"\ntheme[cpu_mid]="#222222"\ntheme[cpu_end]="#333333"\ntheme[main_bg]="#0a0b0c"');
  assert.equal(theme.gradients.cpu, ref, "array object identity preserved");
  assert.equal(theme.gradients.cpu[0], "#111111");
  assert.equal(theme.gradients.cpu[50], "#222222");
  assert.equal(theme.gradients.cpu[100], "#333333");
  assert.equal(theme.colors.main_bg, "#0a0b0c");
  theme.applyDefault();
});
test("grayscale shorthand + start-only stop yields a flat gradient", () => {
  theme.loadThemeText('theme[temp_start]="#cc"');
  assert.equal(theme.gradients.temp[0], "#cccccc");
  assert.equal(theme.gradients.temp[100], "#cccccc");
  theme.applyDefault();
});
test("applyDefault restores btop Default colors", () => {
  theme.loadThemeText('theme[cpu_start]="#000000"\ntheme[cpu_box]="#123456"');
  theme.applyDefault();
  assert.equal(theme.gradients.cpu[0], "#77ca9b");
  assert.equal(theme.colors.cpu_box, "#556d59");
});
test("non-hex / ansi values are ignored, not crashed on", () => {
  theme.loadThemeText('theme[main_fg]="\\e[38;5;12m"\ntheme[cpu_start]="#445566"');
  assert.equal(theme.gradients.cpu[0], "#445566");
  theme.applyDefault();
});
