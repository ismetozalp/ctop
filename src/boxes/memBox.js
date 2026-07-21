// src/boxes/memBox.js
import { Meter } from "../meter.js";
import { BrailleGraph } from "../graph.js";
import { theme } from "../theme.js";
import { humanize } from "../humanize.js";
import { settings } from "../settings.js";

// Disk devices to render: loopN devices (snap squashfs images etc.) are noise
// on most hosts, so they're hidden unless the "loops" toolbar toggle is on.
export function visibleDisks(devs, showLoops) {
  return showLoops ? devs : devs.filter((d) => !/^loop\d+$/.test(d));
}

export class MemBox {
  constructor(root) { this.root = root; }
  mount() {
    this.root.innerHTML = `
      <div class="box mem-box">
        <div class="box-title">mem</div>
        <div class="mem-rows"></div>
        <div class="mem-mounts"></div>
        <div class="mem-disks"></div>
      </div>`;
    this.rowsEl = this.root.querySelector(".mem-rows");
    this.disksEl = this.root.querySelector(".mem-disks");
    this.mountsEl = this.root.querySelector(".mem-mounts");
    this._rows = {}; this._disks = {}; this._mountRows = {};
    for (const [key, grad] of [["used", theme.gradients.used], ["cached", theme.gradients.cached],
        ["available", theme.gradients.available], ["free", theme.gradients.free], ["swap", theme.gradients.used]]) {
      const el = document.createElement("div"); el.className = "mem-row";
      el.innerHTML = `<span class="mem-label">${key}</span><canvas class="mem-meter"></canvas><span class="mem-val"></span>`;
      this.rowsEl.appendChild(el);
      this._rows[key] = { el, meter: new Meter(el.querySelector(".mem-meter"), { gradient: grad, bgColor: theme.colors.meter_bg }),
                          val: el.querySelector(".mem-val") };
    }
  }
  _row(key, value, total) {
    const pct = total > 0 ? value * 100 / total : 0;
    this._rows[key].meter.render(pct);
    this._rows[key].val.textContent = `${humanize(value)} ${pct.toFixed(0)}%`;
  }
  _ensureMounts(paths) {
    if (Object.keys(this._mountRows).length === paths.length && paths.every((p) => this._mountRows[p])) return;
    this.mountsEl.innerHTML = ""; this._mountRows = {};
    for (const p of paths) {
      const el = document.createElement("div"); el.className = "mem-mount";
      el.innerHTML = `<span class="mount-label"></span><canvas class="mount-meter"></canvas><span class="mount-val"></span>`;
      el.querySelector(".mount-label").textContent = p; // textContent: mount path not interpolated as HTML
      this.mountsEl.appendChild(el);
      this._mountRows[p] = { meter: new Meter(el.querySelector(".mount-meter"), { gradient: theme.gradients.used, bgColor: theme.colors.meter_bg }),
                             val: el.querySelector(".mount-val") };
    }
  }
  _ensureDisks(devs) {
    const have = Object.keys(this._disks);
    if (have.length === devs.length && devs.every((d) => this._disks[d])) return;
    this.disksEl.innerHTML = ""; this._disks = {};
    for (const d of devs) {
      const el = document.createElement("div"); el.className = "mem-disk";
      el.innerHTML = `<span class="disk-label">${d}</span>
        <div class="disk-io"><span class="io-tag">R</span><canvas class="disk-r"></canvas>
        <span class="io-tag">W</span><canvas class="disk-w"></canvas></div>`;
      this.disksEl.appendChild(el);
      this._disks[d] = {
        r: new BrailleGraph(el.querySelector(".disk-r"), { height: 2, gradient: theme.gradients.free }),
        w: new BrailleGraph(el.querySelector(".disk-w"), { height: 2, gradient: theme.gradients.used }),
      };
    }
  }
  update(m) {
    this._row("used", m.mem.used, m.mem.total);
    this._row("cached", m.mem.cached, m.mem.total);
    this._row("available", m.mem.available, m.mem.total);
    this._row("free", m.mem.free, m.mem.total);
    if (m.mem.swapTotal > 0) { this._rows.swap.el.style.display = ""; this._row("swap", m.mem.swapUsed, m.mem.swapTotal); }
    else { this._rows.swap.el.style.display = "none"; }
    const paths = Object.keys(m.mounts);
    this._ensureMounts(paths);
    for (const p of paths) {
      const { total, used } = m.mounts[p];
      const pct = total > 0 ? used * 100 / total : 0;
      this._mountRows[p].meter.render(pct);
      this._mountRows[p].val.textContent = `${humanize(used)}/${humanize(total)} ${pct.toFixed(0)}%`;
    }
    const devs = visibleDisks(Object.keys(m.disks), settings.get("showLoops"));
    this._ensureDisks(devs);
    for (const d of devs) {
      const rd = m.disks[d].read.toArray(), wr = m.disks[d].write.toArray();
      const maxR = Math.max(1, ...rd), maxW = Math.max(1, ...wr);
      this._disks[d].r.render(rd, { maxValue: maxR });
      this._disks[d].w.render(wr, { maxValue: maxW });
    }
  }
}
