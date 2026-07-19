import test from "node:test";
import assert from "node:assert/strict";
// Mock localStorage BEFORE importing settings (it loads state at import).
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { settings } = await import("../src/settings.js");

test("defaults are present and typed", () => {
  assert.equal(settings.get("interval"), 2000);
  assert.equal(settings.get("tempScale"), "C");
  assert.equal(settings.get("netBits"), false);
  assert.equal(typeof settings.get("boxes"), "object");
  assert.equal(typeof settings.get("thresholds"), "object");
});
test("set persists to localStorage and get reflects it", () => {
  settings.set("interval", 3000);
  assert.equal(settings.get("interval"), 3000);
  assert.ok(store["ctop.settings"].includes("3000"));
});
test("onChange fires with the changed key", () => {
  let got = null;
  const off = settings.onChange((k) => { got = k; });
  settings.set("paused", true);
  assert.equal(got, "paused");
  off();
  settings.set("paused", false);
  assert.equal(got, "paused"); // unsubscribed: unchanged
});
test("nested box map updates", () => {
  settings.set("boxes", { ...settings.get("boxes"), gpu: false });
  assert.equal(settings.get("boxes").gpu, false);
});
