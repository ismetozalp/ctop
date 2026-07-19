// src/boxes/batteryBox.js
// Self-contained battery box. Polls sysfs directly on its own 2s timer —
// it is not fed by the shared metrics channel.
import { Meter } from "../meter.js";
import { theme } from "../theme.js";

const CANDIDATES = ["BAT0", "BAT1"];

export class BatteryBox {
  constructor(root) { this.root = root; }

  mount() {
    this.root.innerHTML = `
      <div class="box bat-box">
        <div class="box-title">bat</div>
        <div class="bat-body">
          <canvas class="bat-meter"></canvas>
          <span class="bat-pct"></span>
          <span class="bat-status"></span>
          <span class="bat-watts"></span>
        </div>
      </div>`;
    this.meter = new Meter(this.root.querySelector(".bat-meter"),
      { gradient: theme.gradients.cpu, bgColor: theme.colors.meter_bg });
    this.pctEl = this.root.querySelector(".bat-pct");
    this.statusEl = this.root.querySelector(".bat-status");
    this.wattsEl = this.root.querySelector(".bat-watts");
    this._refresh();
    this._timer = setInterval(() => this._refresh(), 2000);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _readFile(path) {
    return window.cockpit.file(path).read();
  }

  async _findBattery() {
    for (const name of CANDIDATES) {
      const base = `/sys/class/power_supply/${name}`;
      try {
        const type = await this._readFile(`${base}/type`);
        if (type && type.trim() === "Battery") return base;
      } catch (e) {
        // not present / unreadable, try next candidate
      }
    }
    return null;
  }

  async _refresh() {
    if (!window.cockpit) return;
    if (this._inFlight) return;
    this._inFlight = true;
    try {
      const base = await this._findBattery();
      if (!base) {
        this.root.style.display = "none";
        return;
      }
      this.root.style.display = "";

      const capacityRaw = await this._readFile(`${base}/capacity`).catch(() => null);
      const statusRaw = await this._readFile(`${base}/status`).catch(() => null);

      let watts = null;
      const powerNowRaw = await this._readFile(`${base}/power_now`).catch(() => null);
      if (powerNowRaw != null) {
        const uw = parseFloat(powerNowRaw);
        if (!Number.isNaN(uw)) watts = uw / 1e6;
      } else {
        const currentRaw = await this._readFile(`${base}/current_now`).catch(() => null);
        const voltageRaw = await this._readFile(`${base}/voltage_now`).catch(() => null);
        if (currentRaw != null && voltageRaw != null) {
          const ua = parseFloat(currentRaw);
          const uv = parseFloat(voltageRaw);
          if (!Number.isNaN(ua) && !Number.isNaN(uv)) watts = (ua * uv) / 1e12;
        }
      }

      const capacity = capacityRaw != null ? parseFloat(capacityRaw) : NaN;
      if (!Number.isNaN(capacity)) {
        this.meter.render(capacity);
        this.pctEl.textContent = `${capacity}%`;
      } else {
        this.pctEl.textContent = "";
      }
      this.statusEl.textContent = statusRaw != null ? statusRaw.trim() : "";
      this.wattsEl.textContent = watts != null ? `${watts.toFixed(2)} W` : "";
    } catch (e) {
      // leave last-known values in place on unexpected error
    } finally {
      this._inFlight = false;
    }
  }
}
