// End-to-end smoke test for the Cockpit Top (ctop) plugin.
//
// Drives real headless Chrome through Cockpit login -> Tools -> Cockpit Top and
// reports what rendered, plus any console/page JS errors. Also exercises a
// theme switch and a process-detail popup, capturing screenshots to ./out/.
//
// Requirements:
//   - `npm install` (devDependency: playwright-core)
//   - A Chrome/Chromium binary (default /usr/bin/google-chrome; override CHROME_BIN)
//   - A creds file with two lines "username\npassword". Default location:
//         ~/.config/claude/ctop-e2e/creds   (chmod 600, kept OUT of the repo)
//     Override with CTOP_E2E_CREDS=/path/to/creds
//   - ctop installed/served (e.g. `make devel-install`) and Cockpit reachable
//         (default https://localhost:9090; override CTOP_BASE)
//
// Usage:  node test/e2e/ctop_test.mjs
import pkg from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = pkg;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const CREDS = process.env.CTOP_E2E_CREDS || join(homedir(), ".config/claude/ctop-e2e/creds");
const BASE = process.env.CTOP_BASE || "https://localhost:9090";
const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const [user, pass] = readFileSync(CREDS, "utf8").split("\n");

const consoleErrors = [], pageErrors = [];
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => pageErrors.push(String(e)));

function fail(msg, code = 1) { console.error("FAIL:", msg); b.close().finally(() => process.exit(code)); }

// --- login
await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
await p.locator("#login-user-input").fill(user);
await p.locator("#login-password-input").fill(pass);
await p.locator("#login-button").click();
await p.waitForSelector("#content, .system-information, nav", { timeout: 20000 }).catch(() => {});
if (/\/(system)?$/.test(new URL(p.url()).pathname) === false && p.url().endsWith("9090/")) fail("login rejected (still on login page)");

// --- open ctop
await p.goto(BASE + "/ctop", { waitUntil: "domcontentloaded", timeout: 20000 });
await p.waitForTimeout(6000);
let frame = null;
for (let i = 0; i < 20 && !frame; i++) {
  frame = p.frames().find((f) => f.url().includes("/ctop/"));
  if (!frame) await p.waitForTimeout(500);
}
if (!frame) fail("ctop iframe not found: " + JSON.stringify(p.frames().map((f) => f.url())));
await frame.waitForSelector("#ctop-grid", { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2000);

const report = await frame.evaluate(() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  const sc = document.querySelector(".proc-scroll");
  return {
    boxes: q(".box-title").map((e) => e.textContent.trim()),
    bannerHidden: (document.getElementById("ctop-banner") || {}).className || "",
    cpuPct: (document.querySelector(".cpu-total-pct") || {}).textContent || "",
    cpuModel: (document.querySelector(".cpu-model") || {}).textContent || "",
    cores: q(".cpu-cores .core-pct").length,
    mounts: q(".mem-mount").length,
    gpuName: (document.querySelector(".gpu-name") || {}).textContent || "",
    sensors: q(".sensors-row").length,
    containers: q(".containers-box tbody tr").length,
    historyStatus: (document.querySelector(".history-status") || {}).textContent || "",
    procRows: q(".proc-table tbody tr").length,
    themeOptions: q("#tb-theme option").length,
    procScroll: sc ? { maxHeight: sc.style.maxHeight, clientH: sc.clientHeight, scrollH: sc.scrollHeight, scrolls: sc.scrollHeight > sc.clientHeight + 4 } : null,
  };
});
console.log("REPORT:", JSON.stringify(report, null, 2));
await p.screenshot({ path: join(OUT, "ctop_full.png"), fullPage: true });

// --- theme switch
try { await frame.selectOption("#tb-theme", "tokyo-night"); await p.waitForTimeout(2500); await p.screenshot({ path: join(OUT, "ctop_tokyo.png"), fullPage: true }); console.log("theme switch: ok"); }
catch (e) { console.log("theme switch err:", e.message); }

// --- process popup
try {
  await frame.locator(".proc-table tbody tr").first().click();
  await p.waitForTimeout(2500);
  const popup = await frame.evaluate(() => ({
    visible: (() => { const x = document.querySelector(".proc-popup"); return x && !x.classList.contains("hidden"); })(),
    hasSpark: !!document.querySelector(".popup-spark"),
    hasLinks: document.querySelectorAll(".popup-links button").length,
    hasRenice: !!document.querySelector(".renice-apply"),
  }));
  console.log("popup:", JSON.stringify(popup));
  await p.screenshot({ path: join(OUT, "ctop_popup.png"), fullPage: true });
} catch (e) { console.log("popup err:", e.message); }

console.log("CONSOLE ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 15), null, 2) : "none");
console.log("PAGE ERRORS:", pageErrors.length ? JSON.stringify(pageErrors.slice(0, 15), null, 2) : "none");
await b.close();
console.log("DONE — screenshots in test/e2e/out/");
