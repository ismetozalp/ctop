// src/app.js — orchestration, toolbar, settings, thresholds, keyboard.
import { Metrics } from "./metrics.js";
import { Processes } from "./processes.js";
import { CpuBox } from "./boxes/cpuBox.js";
import { MemBox } from "./boxes/memBox.js";
import { NetBox } from "./boxes/netBox.js";
import { ProcBox } from "./boxes/procBox.js";
import { GpuBox } from "./boxes/gpuBox.js";
import { BatteryBox } from "./boxes/batteryBox.js";
import { theme } from "./theme.js";
import { settings } from "./settings.js";
import { Updater } from "./update.js";
import { fileBrowserUrl, availableFileBrowsers } from "./navigate.js";
// Tier-2/3 boxes are wired in by the integration step:
import { ContainersBox } from "./boxes/containersBox.js";
import { SensorsBox } from "./boxes/sensorsBox.js";
import { HistoryBox } from "./boxes/historyBox.js";

const root = document.getElementById("ctop-root");
root.innerHTML = `
  <div id="ctop-toolbar">
    <button id="tb-pause"></button>
    <label>every <select id="tb-interval">
      <option value="1000">1s</option><option value="2000">2s</option>
      <option value="3000">3s</option><option value="5000">5s</option>
    </select></label>
    <label>theme <select id="tb-theme"></select></label>
    <label>temp <select id="tb-temp"><option value="C">°C</option><option value="F">°F</option></select></label>
    <label>net <select id="tb-netunit"><option value="byte">B/s</option><option value="bit">b/s</option></select></label>
    <label>open <select id="tb-filebrowser"><option value="files">Files</option><option value="explorer">Explorer</option></select></label>
    <label><input type="checkbox" id="tb-notify"> notify</label>
    <div id="tb-boxes-wrap">
      <button id="tb-boxes">boxes ▾</button>
      <div id="tb-boxes-menu" class="hidden"></div>
    </div>
    <span id="tb-update" title="Check for updates"></span>
    <span id="tb-spacer"></span>
    <span id="tb-hint">keys: p pause · +/− interval · f filter</span>
  </div>
  <div id="ctop-banner" class="hidden"></div>
  <div id="ctop-update-overlay" class="hidden">
    <div class="upd-panel">
      <div class="upd-head"><span class="upd-title"></span><button class="upd-close">✕</button></div>
      <pre class="upd-log"></pre>
    </div>
  </div>
  <div id="ctop-grid">
    <div id="slot-cpu" class="col-full"></div>
    <div id="slot-gpu"></div>
    <div id="slot-left">
      <div id="slot-mem"></div><div id="slot-net"></div><div id="slot-bat"></div>
      <div id="slot-sensors"></div><div id="slot-containers"></div>
    </div>
    <div id="slot-proc"></div>
    <div id="slot-history"></div>
  </div>`;

// ---- boxes -----------------------------------------------------------------
const cpu = new CpuBox(document.getElementById("slot-cpu")); cpu.mount();
const mem = new MemBox(document.getElementById("slot-mem")); mem.mount();
const net = new NetBox(document.getElementById("slot-net")); net.mount();
const gpu = new GpuBox(document.getElementById("slot-gpu")); gpu.mount();
const battery = new BatteryBox(document.getElementById("slot-bat")); battery.mount();
const sensors = new SensorsBox(document.getElementById("slot-sensors")); sensors.mount();
const containers = new ContainersBox(document.getElementById("slot-containers")); containers.mount();
const history = new HistoryBox(document.getElementById("slot-history")); history.mount();

// Installed file-browser plugins → drive the cwd action + toolbar selector.
const fileBrowsers = availableFileBrowsers(window.cockpit && window.cockpit.manifests);
if (fileBrowsers.length && !fileBrowsers.includes(settings.get("fileBrowser"))) settings.set("fileBrowser", fileBrowsers[0]);
// null when no file browser is installed -> ProcBox hides the "Files: cwd" button.
const fileNav = fileBrowsers.length
  ? (path) => { if (window.cockpit && window.cockpit.jump) window.cockpit.jump(fileBrowserUrl(path, settings.get("fileBrowser"))); }
  : null;

let processes = new Processes({ interval: settings.get("interval") });
const proc = new ProcBox(document.getElementById("slot-proc"), {
  onkill: (pid, sig) => processes.kill(pid, sig),
  onrenice: (pid, v) => processes.renice(pid, v),
  unitOf: (pid) => processes.unitOf(pid),
  cwdOf: (pid) => processes.cwdOf(pid),
  openCwd: fileNav,
});
proc.mount();
function startProcesses() { processes.start((list) => { if (!settings.get("paused")) proc.update(list); }); }
startProcesses();

// ---- metrics channel (reconnect + interval changes) ------------------------
let latest = null;
let backoff = 1000;
let metrics;

function connect() {
  metrics = new Metrics({ interval: settings.get("interval") });
  metrics.onsample((m) => { latest = m; render(); hideBanner(); backoff = 1000; });
  metrics.start();
  metrics.channel.addEventListener("close", (_e, opts) => {
    if (opts && opts.problem) {
      showBanner("Metrics channel lost (" + opts.problem + "). Reconnecting…");
      metrics.stop(); // clears the orphaned /proc/meminfo poll timer before reconnecting
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    }
  });
}

const banner = document.getElementById("ctop-banner");
function showBanner(msg) { banner.textContent = msg; banner.classList.remove("hidden"); }
function hideBanner() { banner.classList.add("hidden"); }

function render() {
  if (settings.get("paused") || !latest) return;
  cpu.update(latest); mem.update(latest); net.update(latest);
  checkThresholds(latest);
}

// The proc list scrolls inside its box via CSS (flex + overflow); the whole
// plugin fills the viewport, so no page-level scroll sizing is needed here.
let resizeTimer = null;
window.addEventListener("resize", () => {
  if (resizeTimer) return;
  resizeTimer = setTimeout(() => { resizeTimer = null; if (latest) render(); }, 100);
});

// ---- thresholds + notifications --------------------------------------------
const alertState = {};
function flash(slotId, on) {
  const el = document.getElementById(slotId);
  if (el) el.classList.toggle("alert", on);
}
let lastNotify = 0;
function notify(text) {
  if (!settings.get("notify")) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = performance.now();
  if (now - lastNotify < 60000) return; // at most one per minute
  lastNotify = now;
  try { new Notification("Cockpit Top", { body: text }); } catch { /* ignore */ }
}
function checkThresholds(m) {
  const th = settings.get("thresholds");
  const cpuPct = m.cpu.total.last();
  const memPct = m.mem.total > 0 ? m.mem.used * 100 / m.mem.total : 0;
  const tempC = m.cpu.temp.length ? m.cpu.temp.last() : 0;
  const cpuOver = th.cpu > 0 && cpuPct >= th.cpu;
  const tempOver = th.temp > 0 && tempC >= th.temp;
  const memOver = th.mem > 0 && memPct >= th.mem;
  flash("slot-cpu", cpuOver || tempOver);
  flash("slot-mem", memOver);
  if (cpuOver && !alertState.cpu) notify("CPU " + cpuPct.toFixed(0) + "% ≥ " + th.cpu + "%");
  if (tempOver && !alertState.temp) notify("CPU temp " + tempC.toFixed(0) + "°C ≥ " + th.temp + "°C");
  if (memOver && !alertState.mem) notify("Memory " + memPct.toFixed(0) + "% ≥ " + th.mem + "%");
  alertState.cpu = cpuOver; alertState.temp = tempOver; alertState.mem = memOver;
}

// ---- toolbar wiring --------------------------------------------------------
const pauseBtn = document.getElementById("tb-pause");
function renderPauseLabel() { pauseBtn.textContent = settings.get("paused") ? "▶ resume" : "⏸ pause"; pauseBtn.classList.toggle("active", settings.get("paused")); }
function togglePause() { settings.set("paused", !settings.get("paused")); renderPauseLabel(); if (!settings.get("paused") && latest) render(); }
pauseBtn.addEventListener("click", togglePause);
renderPauseLabel();

const intervalSel = document.getElementById("tb-interval");
intervalSel.value = String(settings.get("interval"));
intervalSel.addEventListener("change", () => {
  settings.set("interval", Number(intervalSel.value));
  if (metrics) metrics.stop();
  connect();
  processes.stop(); processes = new Processes({ interval: settings.get("interval") }); startProcesses();
});

const tempSel = document.getElementById("tb-temp");
tempSel.value = settings.get("tempScale");
tempSel.addEventListener("change", () => { settings.set("tempScale", tempSel.value); if (latest) render(); });
const netUnitSel = document.getElementById("tb-netunit");
netUnitSel.value = settings.get("netBits") ? "bit" : "byte";
netUnitSel.addEventListener("change", () => { settings.set("netBits", netUnitSel.value === "bit"); if (latest) render(); });

const fbSel = document.getElementById("tb-filebrowser");
const fbLabel = fbSel.closest("label");
if (fileBrowsers.length >= 2) {
  // keep only installed options, then let the user choose
  Array.from(fbSel.options).forEach((o) => { if (!fileBrowsers.includes(o.value)) o.remove(); });
  fbSel.value = settings.get("fileBrowser");
  fbSel.addEventListener("change", () => settings.set("fileBrowser", fbSel.value));
} else if (fbLabel) {
  fbLabel.style.display = "none"; // 0 or 1 installed: nothing to choose
}

const notifyChk = document.getElementById("tb-notify");
notifyChk.checked = !!settings.get("notify");
notifyChk.addEventListener("change", () => {
  settings.set("notify", notifyChk.checked);
  if (notifyChk.checked && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
});

// theme dropdown — populated from /usr/share/btop/themes plus "Default"
const themeSel = document.getElementById("tb-theme");
function applyTheme(name) {
  if (!name || name === "Default") { theme.applyDefault(); if (latest) render(); return; }
  if (!window.cockpit) return;
  window.cockpit.file("/usr/share/btop/themes/" + name + ".theme").read()
    .then((txt) => { if (txt) theme.loadThemeText(txt); if (latest) render(); })
    .catch(() => {});
}
function populateThemes() {
  const opt = (v) => { const o = document.createElement("option"); o.value = v; o.textContent = v; return o; };
  themeSel.appendChild(opt("Default"));
  if (window.cockpit) {
    window.cockpit.spawn(["sh", "-c", "ls /usr/share/btop/themes/*.theme 2>/dev/null | xargs -n1 basename | sed 's/\\.theme$//' | sort"], { err: "message" })
      .then((out) => { out.split("\n").filter(Boolean).forEach((n) => themeSel.appendChild(opt(n))); themeSel.value = settings.get("theme"); })
      .catch(() => {});
  }
  themeSel.value = settings.get("theme");
}
themeSel.addEventListener("change", () => { settings.set("theme", themeSel.value); applyTheme(themeSel.value); });
populateThemes();
applyTheme(settings.get("theme"));

// box show/hide menu
const SLOTS = {
  gpu: "slot-gpu", mem: "slot-mem", net: "slot-net", bat: "slot-bat",
  proc: "slot-proc", sensors: "slot-sensors", containers: "slot-containers", history: "slot-history",
};
function applyBoxVisibility() {
  const b = settings.get("boxes");
  for (const [name, slot] of Object.entries(SLOTS)) {
    const el = document.getElementById(slot);
    // Toggle a class with `display:none !important` — self-polling boxes
    // reassign their own root.style.display, which an !important class overrides.
    if (el) el.classList.toggle("ctop-hidden", b[name] === false);
  }
}
const boxesBtn = document.getElementById("tb-boxes");
const boxesMenu = document.getElementById("tb-boxes-menu");
boxesBtn.addEventListener("click", () => boxesMenu.classList.toggle("hidden"));
for (const name of Object.keys(SLOTS)) {
  const row = document.createElement("label");
  const cb = document.createElement("input"); cb.type = "checkbox";
  cb.checked = settings.get("boxes")[name] !== false;
  cb.addEventListener("change", () => { const b = { ...settings.get("boxes"), [name]: cb.checked }; settings.set("boxes", b); applyBoxVisibility(); });
  row.appendChild(cb); row.appendChild(document.createTextNode(" " + name));
  boxesMenu.appendChild(row);
}
applyBoxVisibility();

// ---- self-update (GitHub releases) -----------------------------------------
const updater = new Updater({ repo: settings.get("updateRepo") });
const updEl = document.getElementById("tb-update");
const updOverlay = document.getElementById("ctop-update-overlay");
function updBadge(text, cls, onclick, title) {
  updEl.className = cls || ""; updEl.textContent = text; updEl.onclick = onclick || null;
  if (title) updEl.title = title;
}
updater.loadCurrentVersion()
  .then((v) => updBadge(v ? "v" + v : "", "", () => checkUpdate(true), "Click to check for updates"))
  .catch(() => {});

function checkUpdate(manual) {
  if (!updater.repo) return;
  updBadge("checking…", "", null);
  updater.check().then((res) => {
    if (res.available) {
      updBadge("⬆ update to v" + res.latest.version, "upd-has", () => startUpdate(res.latest),
        "v" + res.latest.version + " available — click to install");
    } else {
      const back = () => updBadge("v" + (res.current || "?"), "", () => checkUpdate(true), "Up to date — click to re-check");
      updBadge("v" + (res.current || "?") + (manual ? " ✓" : ""), "", () => checkUpdate(true), "Up to date — click to re-check");
      if (manual) setTimeout(back, 2000);
    }
  }).catch((e) => updBadge("v" + (updater.current || "?"), "", () => checkUpdate(true), "Update check failed: " + (e.message || e)));
}

function startUpdate(latest) {
  if (!window.confirm("Update Cockpit Top to v" + latest.version + "?\n\nDownloads the release from " + updater.repo +
    ", installs it (requires admin), and restarts Cockpit.")) return;
  const log = updOverlay.querySelector(".upd-log");
  updOverlay.querySelector(".upd-title").textContent = "Updating to v" + latest.version + "…";
  log.textContent = "";
  updOverlay.classList.remove("hidden");
  const append = (t) => { log.textContent += t; log.scrollTop = log.scrollHeight; };
  updater.installStream(latest, append, (opts) => {
    if (opts && opts.problem) append("\n✗ Failed: " + (opts.message || opts.problem) + "\n");
    else { append("\n✓ Installed. Cockpit is restarting — reloading shortly…\n"); setTimeout(() => location.reload(), 7000); }
  });
}
updOverlay.querySelector(".upd-close").addEventListener("click", () => updOverlay.classList.add("hidden"));
if (settings.get("updateCheckOnStart") && updater.repo) setTimeout(() => checkUpdate(false), 4000);

// ---- keyboard shortcuts ----------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === "p" || e.key === " ") { e.preventDefault(); togglePause(); }
  else if (e.key === "+" || e.key === "=") { stepInterval(-1); }
  else if (e.key === "-" || e.key === "_") { stepInterval(1); }
  else if (e.key === "f") { const fi = document.querySelector(".proc-filter"); if (fi) { e.preventDefault(); fi.focus(); } }
});
function stepInterval(dir) {
  const opts = [1000, 2000, 3000, 5000];
  let i = opts.indexOf(settings.get("interval"));
  if (i < 0) i = 1;
  i = Math.max(0, Math.min(opts.length - 1, i + dir));
  intervalSel.value = String(opts[i]);
  intervalSel.dispatchEvent(new Event("change"));
}

connect();

window.addEventListener("beforeunload", () => {
  if (metrics) metrics.stop();
  processes.stop(); gpu.stop(); battery.stop();
  if (sensors.stop) sensors.stop(); if (containers.stop) containers.stop(); if (history.stop) history.stop();
});
