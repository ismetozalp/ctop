// src/app.js
import { Metrics } from "./metrics.js";
import { Processes } from "./processes.js";
import { CpuBox } from "./boxes/cpuBox.js";
import { MemBox } from "./boxes/memBox.js";
import { NetBox } from "./boxes/netBox.js";
import { ProcBox } from "./boxes/procBox.js";

const root = document.getElementById("ctop-root");
root.innerHTML = `
  <div id="ctop-banner" class="hidden"></div>
  <div id="ctop-grid">
    <div id="slot-cpu" class="col-full"></div>
    <div id="slot-left"><div id="slot-mem"></div><div id="slot-net"></div></div>
    <div id="slot-proc"></div>
  </div>`;

const cpu = new CpuBox(document.getElementById("slot-cpu")); cpu.mount();
const mem = new MemBox(document.getElementById("slot-mem")); mem.mount();
const net = new NetBox(document.getElementById("slot-net")); net.mount();

const processes = new Processes({ interval: 2000 });
const proc = new ProcBox(document.getElementById("slot-proc"), { onkill: (pid, sig) => processes.kill(pid, sig) });
proc.mount();
processes.start((list) => proc.update(list));

let latest = null;
let backoff = 1000;
let metrics;

function connect() {
  metrics = new Metrics({ interval: 2000 });
  metrics.onsample((m) => { latest = m; render(); hideBanner(); backoff = 1000; });
  metrics.start();
  metrics.channel.addEventListener("close", (_e, opts) => {
    if (opts && opts.problem) {
      showBanner("Metrics channel lost (" + opts.problem + "). Reconnecting…");
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    }
  });
}

const banner = document.getElementById("ctop-banner");
function showBanner(msg) { banner.textContent = msg; banner.classList.remove("hidden"); }
function hideBanner() { banner.classList.add("hidden"); }

// Repaint only when there is new data (samples arrive every ~2s) or on resize —
// avoids burning CPU redrawing identical frames 60x/s in a monitoring tool.
function render() {
  if (latest) { cpu.update(latest); mem.update(latest); net.update(latest); }
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (resizeTimer) return;
  resizeTimer = setTimeout(() => { resizeTimer = null; render(); }, 100);
});

connect();

window.addEventListener("beforeunload", () => { if (metrics) metrics.stop(); processes.stop(); });
