import test from "node:test";
import assert from "node:assert/strict";
import { NetScaler } from "../src/netscale.js";

test("starts at floor 10 KiB", () => {
  assert.equal(new NetScaler().update(0), 10 * 1024);
});
test("scales up after 5 samples over ceiling", () => {
  const s = new NetScaler();
  let ceil;
  for (let i = 0; i < 5; i++) ceil = s.update(1024 * 1024); // 1 MiB/s, well over floor
  assert.ok(ceil > 10 * 1024, "ceiling should rise");
  // ceiling ~ avg(1MiB)*1.3
  assert.ok(Math.abs(ceil - 1024 * 1024 * 1.3) < 1024, "ceiling ~ avg*1.3");
});
test("does not scale up before 5 consecutive overs", () => {
  const s = new NetScaler();
  s.update(1024 * 1024); s.update(1024 * 1024);
  const ceil = s.update(0); // breaks the streak
  assert.equal(ceil, 10 * 1024);
});
test("scales down after 5 samples below ceiling/10 once ceiling is high", () => {
  const s = new NetScaler();
  for (let i = 0; i < 5; i++) s.update(10 * 1024 * 1024); // push ceiling up to ~13.6 MiB
  let ceil;
  for (let i = 0; i < 5; i++) ceil = s.update(100 * 1024); // 100 KiB, below ceiling/10
  assert.ok(ceil < 10 * 1024 * 1024, "ceiling should drop");
  assert.ok(Math.abs(ceil - 100 * 1024 * 3.0) < 1024, "ceiling ~ avg*3.0");
});
test("down-scale never goes below the 10 KiB floor", () => {
  const s = new NetScaler();
  for (let i = 0; i < 5; i++) s.update(10 * 1024 * 1024); // scale up first
  let ceil;
  for (let i = 0; i < 5; i++) ceil = s.update(1000); // avg*3 = 3000 < floor -> clamps
  assert.equal(ceil, 10 * 1024);
});
