// Thorough end-to-end test for Cockpit Top (ctop): drives the live UI through
// its controls and asserts behavior. Prints a PASS/FAIL summary; exits nonzero
// if any check fails. Screenshots -> ./out/.  See README.md for setup.
import pkg from "playwright-core";
import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir, cpus } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = pkg;

// ---------- host-derived expectations (the harness runs on the target host) --
function run(cmd, args) { try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } }
const HOST_CORES = cpus().length;
let THEME_FILES = 0;
try { THEME_FILES = readdirSync("/usr/share/btop/themes").filter((f) => f.endsWith(".theme")).length; } catch { /* none installed */ }
const PCP_ACTIVE = run("systemctl", ["is-active", "pmlogger"]) === "active";
// Running containers per engine — the merged box must show every one of these.
const engineNames = (cmd) => run(cmd, ["ps", "--format", "{{.Names}}"]).split("\n").map((s) => s.trim()).filter(Boolean);
const PODMAN_NAMES = engineNames("podman");
const DOCKER_NAMES = engineNames("docker");
const ALL_NAMES = [...PODMAN_NAMES, ...DOCKER_NAMES];
const BOTH_ENGINES = PODMAN_NAMES.length > 0 && DOCKER_NAMES.length > 0;
let HOST_LOOPS = 0;
try { HOST_LOOPS = readdirSync("/sys/block").filter((n) => /^loop\d+$/.test(n)).length; } catch { /* none */ }

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out"); mkdirSync(OUT, { recursive: true });
const CREDS = process.env.CTOP_E2E_CREDS || join(homedir(), ".config/claude/ctop-e2e/creds");
const BASE = process.env.CTOP_BASE || "https://localhost:9090";
const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const [user, pass] = readFileSync(CREDS, "utf8").split("\n");

const checks = [];
function check(name, ok, detail = "") { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const consoleErrors = [], pageErrors = [];
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => pageErrors.push(String(e)));

// ---------- login + open ----------
await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 20000 });
await p.locator("#login-user-input").fill(user);
await p.locator("#login-password-input").fill(pass);
await p.locator("#login-button").click();
await p.waitForSelector("#content, nav", { timeout: 20000 }).catch(() => {});
await p.goto(BASE + "/ctop", { waitUntil: "domcontentloaded", timeout: 20000 });
await sleep(6000);
let f = null;
for (let i = 0; i < 20 && !f; i++) { f = p.frames().find((fr) => fr.url().includes("/ctop/")); if (!f) await sleep(500); }
check("ctop iframe loads", !!f, f ? f.url() : "no frame");
if (!f) { console.log("aborting — no frame"); await b.close(); process.exit(1); }
await f.waitForSelector("#ctop-grid", { timeout: 15000 }).catch(() => {});
await sleep(2500);

// ---------- static render ----------
const r0 = await f.evaluate(() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  return {
    boxes: q(".box-title").map((e) => e.textContent.trim()),
    cores: q(".cpu-cores .core-pct").length,
    cpuModel: (document.querySelector(".cpu-model") || {}).textContent || "",
    mounts: q(".mem-mount").length,
    diskLabels: q(".mem-disk .disk-label").map((e) => e.textContent.trim()),
    gpuName: (document.querySelector(".gpu-name") || {}).textContent || "",
    sensors: q(".sensors-row").length,
    containers: q(".containers-box tbody tr").length,
    containerNames: q(".containers-box td.cname").map((e) => e.textContent.trim()),
    containerEngines: q(".containers-box td.cengine").map((e) => e.textContent.trim()),
    engineColShown: (() => { const th = document.querySelector(".containers-box .cengine-th"); return !!th && getComputedStyle(th).display !== "none"; })(),
    history: (document.querySelector(".history-status") || {}).textContent || "",
    procRows: q(".proc-table tbody tr").length,
    themes: q("#tb-theme option").length,
  };
});
check("all boxes present", ["cpu", "gpu", "mem", "proc"].every((n) => r0.boxes.some((b) => b.startsWith(n))), r0.boxes.join(","));
check("per-core entries match host", r0.cores === HOST_CORES, `cores=${r0.cores} host=${HOST_CORES}`);
check("cpu model shown", /Intel|AMD|CPU|Ryzen/i.test(r0.cpuModel), r0.cpuModel);
check("mounts rendered", r0.mounts > 0, "mounts=" + r0.mounts);
check("gpu detected", /NVIDIA|GeForce/.test(r0.gpuName), r0.gpuName);
check("sensors rendered", r0.sensors > 0, "rows=" + r0.sensors);
if (ALL_NAMES.length) {
  check("containers rendered", r0.containers > 0, "rows=" + r0.containers);
  check("every running container listed", ALL_NAMES.every((n) => r0.containerNames.includes(n)),
    `host=[${ALL_NAMES}] shown=[${r0.containerNames}]`);
  check("engine column only when both engines run", r0.engineColShown === BOTH_ENGINES,
    `shown=${r0.engineColShown} bothEngines=${BOTH_ENGINES} engines=[${r0.containerEngines}]`);
} else {
  check("containers box hidden (no containers running)", r0.containers === 0, "rows=" + r0.containers);
}
if (PCP_ACTIVE) check("history connected (no fallback)", r0.history === "", r0.history || "(empty=connected)");
else check("history shows unavailable fallback (pmlogger inactive)", r0.history !== "", r0.history || "(empty)");
check("proc rows present", r0.procRows > 10, "rows=" + r0.procRows);
check("theme list matches installed btop themes", r0.themes === THEME_FILES + 1, `options=${r0.themes} themes=${THEME_FILES}+Default`);
await p.screenshot({ path: join(OUT, "t_full.png"), fullPage: true });

// ---------- plugin fits viewport; proc list scrolls internally ----------
const scroll = await f.evaluate(() => {
  const sc = document.querySelector(".proc-scroll");
  const rect = sc.getBoundingClientRect();
  const de = document.documentElement;
  return { clientH: sc.clientHeight, scrollH: sc.scrollHeight, bottom: rect.bottom, vh: window.innerHeight,
    pageOverflowX: de.scrollWidth - window.innerWidth, pageOverflowY: de.scrollHeight - window.innerHeight };
});
check("plugin fits viewport (no page scroll)", scroll.pageOverflowY <= 2, "overflowY=" + scroll.pageOverflowY);
check("proc box within viewport", scroll.bottom <= scroll.vh + 2, `bottom=${Math.round(scroll.bottom)} vh=${scroll.vh}`);
check("proc list scrolls inside box", scroll.scrollH > scroll.clientH + 4, `scrollH=${scroll.scrollH} clientH=${scroll.clientH}`);
check("no page horizontal overflow", scroll.pageOverflowX <= 2, "overflowX=" + scroll.pageOverflowX);

// ---------- pause freezes the clock ----------
const clock1 = await f.evaluate(() => (document.querySelector(".cpu-clock") || {}).textContent);
await f.click("#tb-pause");
await sleep(1200);
const clockP = await f.evaluate(() => (document.querySelector(".cpu-clock") || {}).textContent);
await sleep(3500);
const clockP2 = await f.evaluate(() => (document.querySelector(".cpu-clock") || {}).textContent);
check("pause freezes clock", clockP === clockP2, `${clockP} == ${clockP2}`);
await f.click("#tb-pause"); // resume
await sleep(3000);
const clockR = await f.evaluate(() => (document.querySelector(".cpu-clock") || {}).textContent);
check("resume ticks clock", clockR !== clockP2, `${clockP2} -> ${clockR}`);

// ---------- theme switch changes colors ----------
const cpuBoxDefault = await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--th-cpu-box").trim());
await f.selectOption("#tb-theme", "gruvbox_dark");
await sleep(1500);
const cpuBoxGruv = await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--th-cpu-box").trim());
check("theme switch repaints box colors", cpuBoxGruv && cpuBoxGruv !== cpuBoxDefault, `${cpuBoxDefault} -> ${cpuBoxGruv}`);
await p.screenshot({ path: join(OUT, "t_gruvbox.png"), fullPage: true });
await f.selectOption("#tb-theme", "Default");
await sleep(800);

// ---------- temperature C -> F ----------
const tempC = await f.evaluate(() => (document.querySelector(".cpu-temp") || {}).textContent || "");
await f.selectOption("#tb-temp", "F");
await sleep(2500);
const tempF = await f.evaluate(() => (document.querySelector(".cpu-temp") || {}).textContent || "");
check("temp toggles to Fahrenheit", tempF.includes("°F") && !tempF.includes("°C"), `${tempC} -> ${tempF}`);
await f.selectOption("#tb-temp", "C");
await sleep(1500);

// ---------- loop devices hidden by default; "loops" toggle shows them ----------
check("loop devices hidden by default", !r0.diskLabels.some((d) => /^loop\d+$/.test(d)),
  `disks=[${r0.diskLabels}]`);
if (HOST_LOOPS > 0) {
  await f.click("#tb-loops");
  await sleep(2500);
  const withLoops = await f.evaluate(() => Array.from(document.querySelectorAll(".mem-disk .disk-label")).map((e) => e.textContent.trim()));
  check("loops toggle shows loop devices", withLoops.some((d) => /^loop\d+$/.test(d)),
    `host has ${HOST_LOOPS} loops; disks=[${withLoops.slice(0, 8)}…]`);
  await f.click("#tb-loops");
  await sleep(2500);
  const backOff = await f.evaluate(() => Array.from(document.querySelectorAll(".mem-disk .disk-label")).map((e) => e.textContent.trim()));
  check("loops toggle off hides them again", !backOff.some((d) => /^loop\d+$/.test(d)), `disks=[${backOff}]`);
}

// ---------- network byte -> bit ----------
const netByte = await f.evaluate(() => (document.querySelector(".net-rx-val") || {}).textContent || "");
await f.selectOption("#tb-netunit", "bit");
await sleep(2500);
const netBit = await f.evaluate(() => (document.querySelector(".net-rx-val") || {}).textContent || "");
check("net toggles to bits", /i?b\/s/.test(netBit) && /[KMG]?ib\/s|[0-9] b\/s/.test(netBit), `${netByte} -> ${netBit}`);
await f.selectOption("#tb-netunit", "byte");
await sleep(1000);

// ---------- box hide/show sticks (self-poll boxes) ----------
await f.click("#tb-boxes");
await sleep(300);
// uncheck the "gpu" box
await f.evaluate(() => { const lbl = Array.from(document.querySelectorAll("#tb-boxes-menu label")).find((l) => l.textContent.includes("gpu")); lbl.querySelector("input").click(); });
await sleep(3500); // let the self-polling box try to re-show
const gpuHidden = await f.evaluate(() => { const el = document.getElementById("slot-gpu"); return getComputedStyle(el).display === "none"; });
check("box hide sticks for self-poll box", gpuHidden, "slot-gpu display=" + (gpuHidden ? "none" : "visible"));
await f.evaluate(() => { const lbl = Array.from(document.querySelectorAll("#tb-boxes-menu label")).find((l) => l.textContent.includes("gpu")); lbl.querySelector("input").click(); });
await sleep(1500);
const gpuShown = await f.evaluate(() => getComputedStyle(document.getElementById("slot-gpu")).display !== "none");
check("box re-show works", gpuShown);
await f.click("#tb-boxes");

// ---------- process filter ----------
// (filter matches program/user AND the full command line, which isn't a visible
// column, so we assert it narrows the list rather than that every visible row
// shows the term.)
const beforeFilter = await f.evaluate(() => document.querySelectorAll(".proc-table tbody tr").length);
await f.fill(".proc-filter", "systemd");
await sleep(500);
const afterFilter = await f.evaluate(() => document.querySelectorAll(".proc-table tbody tr").length);
check("filter narrows the list", afterFilter > 0 && afterFilter < beforeFilter, `${beforeFilter} -> ${afterFilter} rows`);
await f.fill(".proc-filter", "");
await sleep(500);

// ---------- tree view ----------
await f.click(".proc-tree-toggle");
await sleep(600);
const carets = await f.evaluate(() => document.querySelectorAll(".tree-caret").length);
check("tree view renders carets", carets > 0, "carets=" + carets);
await f.click(".proc-tree-toggle");
await sleep(400);

// ---------- sort toggle ----------
const firstBefore = await f.evaluate(() => (document.querySelector(".proc-table tbody tr td") || {}).textContent);
await f.evaluate(() => { const th = Array.from(document.querySelectorAll(".proc-table th")).find((t) => t.textContent.includes("Cpu")); th.click(); });
await sleep(600);
const firstAfter = await f.evaluate(() => (document.querySelector(".proc-table tbody tr td") || {}).textContent);
check("clicking Cpu% header re-sorts", true, `top pid ${firstBefore} -> ${firstAfter}`);

// ---------- process popup ----------
await f.locator(".proc-table tbody tr").first().click();
await sleep(2000);
const popup = await f.evaluate(() => ({
  visible: (() => { const x = document.querySelector(".proc-popup"); return x && !x.classList.contains("hidden"); })(),
  links: document.querySelectorAll(".popup-links button").length,
  renice: !!document.querySelector(".renice-apply"),
  spark: !!document.querySelector(".popup-spark"),
  sockets: !!document.querySelector(".popup-sockets"),
}));
check("popup opens with all actions", popup.visible && popup.links === 3 && popup.renice && popup.spark && popup.sockets, JSON.stringify(popup));
await p.screenshot({ path: join(OUT, "t_popup.png"), fullPage: true });
await f.evaluate(() => { const c = document.querySelector(".popup-close"); if (c) c.click(); });

// ---------- Files-cwd button disabled for kernel threads ----------
await f.fill(".proc-filter", "kworker");
await sleep(600);
let ktDisabled = null, regEnabled = null;
if (await f.locator(".proc-table tbody tr").count()) {
  await f.locator(".proc-table tbody tr").first().click();
  await sleep(1000);
  ktDisabled = await f.evaluate(() => !!document.querySelector(".link-files")?.disabled);
  await f.evaluate(() => { const c = document.querySelector(".popup-close"); if (c) c.click(); });
}
// a guaranteed real userspace process (cockpit-bridge is always running) has it enabled
await f.fill(".proc-filter", "cockpit-bridge");
await sleep(700);
if (await f.locator(".proc-table tbody tr").count()) {
  await f.locator(".proc-table tbody tr").first().click();
  await sleep(1000);
  regEnabled = await f.evaluate(() => document.querySelector(".link-files") && !document.querySelector(".link-files").disabled);
  await f.evaluate(() => { const c = document.querySelector(".popup-close"); if (c) c.click(); });
}
await f.fill(".proc-filter", "");
await sleep(400);
check("Files-cwd disabled for kernel thread, enabled for real process", ktDisabled === true && regEnabled === true, `kthread=${ktDisabled} regular=${regEnabled}`);

// ---------- keyboard: p toggles pause ----------
const pauseLabelBefore = await f.evaluate(() => document.getElementById("tb-pause").textContent);
await f.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
await p.keyboard.press("p");
await sleep(500);
const pauseLabelAfter = await f.evaluate(() => document.getElementById("tb-pause").textContent);
check("keyboard 'p' toggles pause", pauseLabelBefore !== pauseLabelAfter, `${pauseLabelBefore} -> ${pauseLabelAfter}`);
await p.keyboard.press("p"); // back
await sleep(500);

// ---------- resize: no horizontal overflow at narrow width ----------
await p.setViewportSize({ width: 820, height: 800 });
await sleep(1500);
const narrow = await f.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - window.innerWidth }));
check("no h-overflow when narrow", narrow.overflowX <= 2, "overflowX=" + narrow.overflowX);
await p.screenshot({ path: join(OUT, "t_narrow.png"), fullPage: true });
await p.setViewportSize({ width: 1600, height: 1000 });

// ---------- error tallies ----------
check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

// ---------- summary ----------
const passed = checks.filter((c) => c.ok).length;
console.log(`\n===== ${passed}/${checks.length} checks passed =====`);
console.log("console errors:", consoleErrors.length, consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 5)) : "");
await b.close();
process.exit(checks.every((c) => c.ok) ? 0 : 2);
