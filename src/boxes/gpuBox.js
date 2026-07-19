// src/boxes/gpuBox.js
import { BrailleGraph } from "../graph.js";
import { Meter } from "../meter.js";
import { theme } from "../theme.js";
import { humanize } from "../humanize.js";
import { RingBuffer } from "../ringbuffer.js";
import { settings } from "../settings.js";

const scale = (c) => settings.get("tempScale") === "F" ? { v: c * 9 / 5 + 32, u: "°F" } : { v: c, u: "°C" };

export class GpuBox {
  constructor(root) { this.root = root; }
  mount() {
    this.root.innerHTML = `
      <div class="box gpu-box">
        <div class="box-title">gpu</div>
        <div class="gpu-header">
          <span class="gpu-name"></span>
        </div>
        <div class="gpu-row gpu-util-row">
          <span class="gpu-label">util</span>
          <canvas class="gpu-util-meter"></canvas>
          <span class="gpu-util-pct">--%</span>
        </div>
        <canvas class="gpu-graph"></canvas>
        <div class="gpu-row gpu-mem-row">
          <span class="gpu-label">mem</span>
          <canvas class="gpu-mem-meter"></canvas>
          <span class="gpu-mem-val">-- MiB / -- MiB</span>
        </div>
        <div class="gpu-row gpu-misc-row">
          <span class="gpu-temp">--°C</span>
          <span class="gpu-power">-- W</span>
        </div>
      </div>`;
    this.nameEl = this.root.querySelector(".gpu-name");
    this.utilMeter = new Meter(this.root.querySelector(".gpu-util-meter"),
      { gradient: theme.gradients.cpu, bgColor: theme.colors.meter_bg });
    this.utilPctEl = this.root.querySelector(".gpu-util-pct");
    this.graph = new BrailleGraph(this.root.querySelector(".gpu-graph"),
      { height: 3, gradient: theme.gradients.cpu });
    this.memMeter = new Meter(this.root.querySelector(".gpu-mem-meter"),
      { gradient: theme.gradients.used, bgColor: theme.colors.meter_bg });
    this.memValEl = this.root.querySelector(".gpu-mem-val");
    this.tempEl = this.root.querySelector(".gpu-temp");
    this.powerEl = this.root.querySelector(".gpu-power");
    this._util = new RingBuffer(600);
    this._inFlight = false;
    this._refresh();
    this._timer = setInterval(() => this._refresh(), 2000);
  }
  _refresh() {
    if (!window.cockpit) return;
    if (this._inFlight) return;
    this._inFlight = true;
    window.cockpit.spawn(
      ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
        "--format=csv,noheader,nounits"],
      { err: "message" })
      .then((out) => {
        this._inFlight = false;
        const line = String(out).split("\n").find((l) => l.trim().length > 0);
        if (!line) { this.root.style.display = "none"; return; }
        const fields = line.split(",").map((s) => s.trim());
        if (fields.length < 6) { this.root.style.display = "none"; return; }
        const [name, utilStr, memUsedStr, memTotalStr, tempStr, powerStr] = fields;
        const util = parseFloat(utilStr);
        const memUsed = parseFloat(memUsedStr);
        const memTotal = parseFloat(memTotalStr);
        const temp = parseFloat(tempStr);
        const power = parseFloat(powerStr);

        this.root.style.display = "";
        this.nameEl.textContent = name;

        this._util.push(Number.isFinite(util) ? util : 0);
        this.graph.render(this._util.toArray(), { maxValue: 100 });
        this.utilMeter.render(Number.isFinite(util) ? util : 0);
        this.utilPctEl.textContent = (Number.isFinite(util) ? util.toFixed(0) : "--") + "%";

        const memPct = memTotal > 0 ? (memUsed * 100 / memTotal) : 0;
        this.memMeter.render(memPct);
        if (Number.isFinite(memUsed) && Number.isFinite(memTotal)) {
          this.memValEl.textContent = `${humanize(memUsed * 1048576)} / ${humanize(memTotal * 1048576)}`;
        } else {
          this.memValEl.textContent = "-- MiB / -- MiB";
        }

        if (Number.isFinite(temp)) { const s = scale(temp); this.tempEl.textContent = s.v.toFixed(0) + s.u; }
        else this.tempEl.textContent = "--°C";
        this.powerEl.textContent = (Number.isFinite(power) ? power.toFixed(0) : "--") + " W";
      })
      .catch(() => {
        this._inFlight = false;
        this.root.style.display = "none";
      });
  }
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
}
