// src/boxes/cpuBox.js
import { BrailleGraph } from "../graph.js";
import { Meter } from "../meter.js";
import { theme } from "../theme.js";

export class CpuBox {
  constructor(root) { this.root = root; }
  mount() {
    this.root.innerHTML = `
      <div class="box cpu-box">
        <div class="box-title">cpu</div>
        <div class="cpu-header">
          <canvas class="cpu-total-meter"></canvas>
          <span class="cpu-total-pct">--%</span>
          <span class="cpu-freq"></span>
          <span class="cpu-load">load: -- -- --</span>
          <span class="cpu-temp"></span>
          <span class="cpu-model"></span>
        </div>
        <canvas class="cpu-graph"></canvas>
        <div class="cpu-cores"></div>
      </div>`;
    this.totalMeter = new Meter(this.root.querySelector(".cpu-total-meter"),
      { gradient: theme.gradients.cpu, bgColor: theme.colors.meter_bg });
    this.graph = new BrailleGraph(this.root.querySelector(".cpu-graph"),
      { height: 6, gradient: theme.gradients.cpu });
    this.pctEl = this.root.querySelector(".cpu-total-pct");
    this.loadEl = this.root.querySelector(".cpu-load");
    this.tempEl = this.root.querySelector(".cpu-temp");
    this.freqEl = this.root.querySelector(".cpu-freq");
    this.modelEl = this.root.querySelector(".cpu-model");
    this.coresEl = this.root.querySelector(".cpu-cores");
    this._coreMeters = [];
    this._refreshSystem();
  }
  // Load average + CPU frequency aren't in the metrics1 channel; read them from
  // /proc and /sys on the sample cadence (update() calls this ~once per 2s).
  // In-flight guards prevent overlapping reads if a read is slow.
  _refreshSystem() {
    if (!window.cockpit) return;
    if (!this._loadInFlight) {
      this._loadInFlight = true;
      window.cockpit.file("/proc/loadavg").read()
        .then((c) => { this._loadInFlight = false; if (c) { const p = c.split(" "); this.loadEl.textContent = `load: ${p[0]} ${p[1]} ${p[2]}`; } })
        .catch(() => { this._loadInFlight = false; });
    }
    if (!this._freqInFlight) {
      this._freqInFlight = true;
      window.cockpit.file("/sys/devices/system/cpu/cpufreq/policy0/scaling_cur_freq").read()
        .then((c) => { this._freqInFlight = false; const khz = parseInt(c, 10); if (khz > 0) this.freqEl.textContent = (khz / 1e6).toFixed(2) + " GHz"; })
        .catch(() => { this._freqInFlight = false; });
    }
  }
  _ensureCoreMeters(n) {
    if (this._coreMeters.length === n) return;
    this.coresEl.innerHTML = "";
    this._coreMeters = [];
    for (let i = 0; i < n; i++) {
      const wrap = document.createElement("div");
      wrap.className = "core";
      wrap.innerHTML = `<span class="core-label">c${i}</span><canvas class="core-meter"></canvas><span class="core-pct">--</span>`;
      this.coresEl.appendChild(wrap);
      this._coreMeters.push({
        meter: new Meter(wrap.querySelector(".core-meter"), { gradient: theme.gradients.cpu, bgColor: theme.colors.meter_bg }),
        pct: wrap.querySelector(".core-pct"),
      });
    }
  }
  update(m) {
    this._refreshSystem();
    const total = m.cpu.total.last();
    this.pctEl.textContent = total.toFixed(0) + "%";
    this.totalMeter.render(total);
    this.graph.render(m.cpu.total.toArray());
    this._ensureCoreMeters(m.cpu.cores.length);
    m.cpu.cores.forEach((rb, i) => {
      const v = rb.last();
      this._coreMeters[i].meter.render(v);
      this._coreMeters[i].pct.textContent = v.toFixed(0);
    });
    if (m.cpu.temp.length) this.tempEl.textContent = m.cpu.temp.last().toFixed(0) + "°C";
    if (m.cpu.model && this.modelEl.textContent !== m.cpu.model) this.modelEl.textContent = m.cpu.model;
  }
}
