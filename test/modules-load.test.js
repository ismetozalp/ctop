import test from "node:test";
import assert from "node:assert/strict";

// Smoke test: every node-safe module must import without throwing (catches
// bad imports and top-level crashes across the whole tree). app.js is excluded
// because it executes DOM bootstrap code at module load.
const CORE = {
  "gradient.js": "buildGradient", "humanize.js": "humanize", "ringbuffer.js": "RingBuffer",
  "graph.js": "quantize", "meter.js": "Meter", "netscale.js": "NetScaler",
  "decompress.js": "Decompressor", "procparse.js": "parsePs", "sort.js": "sortProcs",
  "theme.js": "theme", "settings.js": "settings", "metrics.js": "Metrics", "processes.js": "Processes",
};
for (const [file, exp] of Object.entries(CORE)) {
  test(`src/${file} imports and exports ${exp}`, async () => {
    const m = await import("../src/" + file);
    assert.ok(m[exp] !== undefined, `${exp} should be exported`);
  });
}

const BOXES = ["cpuBox", "memBox", "netBox", "procBox", "gpuBox", "batteryBox", "sensorsBox", "containersBox", "historyBox"];
for (const box of BOXES) {
  test(`src/boxes/${box}.js imports and exports a class`, async () => {
    const m = await import("../src/boxes/" + box + ".js");
    const cls = Object.values(m).find((v) => typeof v === "function");
    assert.ok(cls, "a class/function export is present");
    assert.equal(typeof cls.prototype.mount, "function", "box has a mount() method");
  });
}
