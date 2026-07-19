// src/boxes/cpuBox.js
import { BrailleGraph } from "../graph.js";
import { Meter } from "../meter.js";
import { theme } from "../theme.js";
import { settings } from "../settings.js";

const scale = (c) => settings.get("tempScale") === "F" ? { v: c * 9 / 5 + 32, u: "°F" } : { v: c, u: "°C" };

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
          <span class="cpu-clock"></span>
          <span class="cpu-uptime"></span>
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
    this.clockEl = this.root.querySelector(".cpu-clock");
    this.uptimeEl = this.root.querySelector(".cpu-uptime");
    this.coresEl = this.root.querySelector(".cpu-cores");
    this._coreMeters = [];
    this._coreTemps = null; // { packageTemp, cores: [n,...] }
    this._hwmonPath = null; // cached coretemp hwmon dir, "" if none found
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
    if (!this._uptimeInFlight) {
      this._uptimeInFlight = true;
      window.cockpit.file("/proc/uptime").read()
        .then((c) => {
          this._uptimeInFlight = false;
          if (!c) return;
          const secs = parseFloat(c.split(" ")[0]);
          if (!(secs >= 0)) return;
          const days = Math.floor(secs / 86400);
          const hh = Math.floor((secs % 86400) / 3600);
          const mm = Math.floor((secs % 3600) / 60);
          const hhmm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          this.uptimeEl.textContent = days > 0 ? `up ${days}d ${hhmm}` : `up ${hhmm}`;
        })
        .catch(() => { this._uptimeInFlight = false; });
    }
    this._refreshCoreTemps();
  }
  // Discover the coretemp (or k10temp) hwmon dir once, then poll its
  // temp*_input files each cycle. Per-core mapping isn't in the metrics
  // channel, so this box reads sysfs directly.
  _refreshCoreTemps() {
    if (!window.cockpit) return;
    if (this._tempInFlight) return;
    this._tempInFlight = true;
    const finish = () => { this._tempInFlight = false; };

    const readLabelsAndValues = (dir) => {
      window.cockpit.spawn(["sh", "-c", `grep -H . ${dir}/temp*_label 2>/dev/null; grep -H . ${dir}/temp*_input 2>/dev/null`], { err: "message" })
        .then((out) => {
          const labels = {};
          const values = {};
          out.split("\n").forEach((line) => {
            const m = line.match(/temp(\d+)_(label|input):(.*)$/);
            if (!m) return;
            const idx = m[1];
            if (m[2] === "label") labels[idx] = m[3].trim();
            else values[idx] = parseInt(m[3], 10);
          });
          let packageTemp = null;
          const cores = [];
          Object.keys(labels).forEach((idx) => {
            const label = labels[idx];
            const v = values[idx];
            if (v === undefined || Number.isNaN(v)) return;
            const celsius = v / 1000;
            if (/package/i.test(label)) packageTemp = celsius;
            else if (/^core\s*(\d+)/i.test(label)) {
              const cm = label.match(/^core\s*(\d+)/i);
              cores[parseInt(cm[1], 10)] = celsius;
            }
          });
          this._coreTemps = { packageTemp, cores };
          finish();
        })
        .catch(finish);
    };

    if (this._hwmonPath !== null) {
      if (this._hwmonPath) readLabelsAndValues(this._hwmonPath);
      else finish();
      return;
    }

    window.cockpit.spawn(["sh", "-c", "for f in /sys/class/hwmon/hwmon*/name; do echo \"$f:$(cat \"$f\" 2>/dev/null)\"; done"], { err: "message" })
      .then((out) => {
        let found = "";
        let fallback = "";
        out.split("\n").forEach((line) => {
          const m = line.match(/^(.*)\/name:(.*)$/);
          if (!m) return;
          const dir = m[1];
          const name = m[2].trim();
          if (name === "coretemp") found = dir;
          else if (name === "k10temp" && !fallback) fallback = dir;
        });
        this._hwmonPath = found || fallback || "";
        if (this._hwmonPath) readLabelsAndValues(this._hwmonPath);
        else finish();
      })
      .catch(finish);
  }
  _ensureCoreMeters(n) {
    if (this._coreMeters.length === n) return;
    this.coresEl.innerHTML = "";
    this._coreMeters = [];
    for (let i = 0; i < n; i++) {
      const wrap = document.createElement("div");
      wrap.className = "core";
      wrap.innerHTML = `<span class="core-label">c${i}</span><canvas class="core-graph"></canvas><span class="core-pct">--</span>`;
      this.coresEl.appendChild(wrap);
      this._coreMeters.push({
        graph: new BrailleGraph(wrap.querySelector(".core-graph"), { height: 1, gradient: theme.gradients.cpu }),
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
    const nCores = m.cpu.cores.length;
    const coreTemps = this._coreTemps && this._coreTemps.cores;
    m.cpu.cores.forEach((rb, i) => {
      const v = rb.last();
      this._coreMeters[i].graph.render(rb.toArray());
      let text = v.toFixed(0) + "%";
      if (coreTemps && coreTemps.length) {
        const physIdx = Math.floor(i * coreTemps.length / nCores);
        const t = coreTemps[physIdx];
        if (t !== undefined) { const s = scale(t); text += " " + s.v.toFixed(0) + s.u; }
      }
      this._coreMeters[i].pct.textContent = text;
    });
    if (this._coreTemps && this._coreTemps.packageTemp != null) {
      const s = scale(this._coreTemps.packageTemp);
      this.tempEl.textContent = s.v.toFixed(0) + s.u;
    } else if (m.cpu.temp.length) {
      const s = scale(m.cpu.temp.last());
      this.tempEl.textContent = s.v.toFixed(0) + s.u;
    }
    if (m.cpu.model && this.modelEl.textContent !== m.cpu.model) this.modelEl.textContent = m.cpu.model;
    this.clockEl.textContent = new Date().toLocaleTimeString();
  }
}
