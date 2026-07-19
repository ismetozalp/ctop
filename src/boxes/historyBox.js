// src/boxes/historyBox.js
// Back-in-time CPU history, sourced from a Cockpit PCP archive channel
// (source:"pcp-archive"). This is fundamentally different from the other
// boxes: it is NOT fed by the shared live metrics.js channel — it opens its
// own metrics1 channel against the archive.
//
// cockpit-pcp may not be installed on the target host, in which case the
// channel closes immediately with a problem (commonly "not-supported"). PCP
// metric names/units and the exact archive semantics could not be verified
// in this environment (no cockpit-pcp available), so everything here is
// written defensively: channel setup/parsing is wrapped in try/catch and the
// box treats absolutely any failure - malformed message, channel error,
// close-with-problem, or no window.cockpit at all - as "history unavailable"
// rather than throwing.
import { BrailleGraph } from "../graph.js";
import { theme } from "../theme.js";
import { RingBuffer } from "../ringbuffer.js";

const UNAVAILABLE_MSG = "Install cockpit-pcp for history (dnf install cockpit-pcp)";
const METRICS = [
  { name: "kernel.all.cpu.user", derive: "rate" },
  { name: "kernel.all.cpu.sys", derive: "rate" },
];

export class HistoryBox {
  constructor(root) {
    this.root = root;
    this._buf = new RingBuffer(600);
    this._index = null;
    this._prevSample = null; // for metrics1 diff-decoding (no instances -> flat merge is enough)
    this._closed = false;
  }

  mount() {
    this.root.innerHTML = `
      <div class="box history-box">
        <div class="box-title">history (PCP)</div>
        <canvas class="history-graph"></canvas>
        <div class="history-status">connecting to PCP archive...</div>
      </div>`;
    this.graphEl = this.root.querySelector(".history-graph");
    this.statusEl = this.root.querySelector(".history-status");
    this.graph = new BrailleGraph(this.graphEl, { height: 5, gradient: theme.gradients.cpu });
    this._start();
  }

  _setUnavailable(msg) {
    this._closed = true;
    this.graphEl.style.display = "none";
    this.statusEl.textContent = msg || UNAVAILABLE_MSG;
  }

  _start() {
    if (!window.cockpit || typeof window.cockpit.channel !== "function") {
      this._setUnavailable(UNAVAILABLE_MSG);
      return;
    }
    try {
      this.channel = window.cockpit.channel({
        payload: "metrics1",
        source: "pcp-archive",
        interval: 60000,
        metrics: METRICS,
      });
      this.channel.addEventListener("message", (_ev, payload) => this._onmessage(payload));
      this.channel.addEventListener("close", (_ev, options) => {
        const problem = options && options.problem;
        if (problem) this._setUnavailable(UNAVAILABLE_MSG);
        // A clean close with no problem just means the archive channel ended;
        // leave whatever history we already rendered in place.
      });
    } catch (e) {
      this._setUnavailable(UNAVAILABLE_MSG);
    }
  }

  _onmessage(payload) {
    if (this._closed) return;
    let data;
    try {
      data = JSON.parse(payload);
    } catch (e) {
      return; // malformed message; ignore rather than throw
    }
    try {
      if (!Array.isArray(data)) {
        this._onmeta(data);
      } else {
        this._onsamples(data);
      }
    } catch (e) {
      // Any parsing/semantics surprise from an unverified archive format:
      // don't let it kill the box, just skip this message.
    }
  }

  _onmeta(meta) {
    this._index = {};
    (meta.metrics || []).forEach((m, i) => { this._index[m.name] = i; });
  }

  _onsamples(samples) {
    if (!this._index) return; // meta hasn't arrived yet
    const posUser = this._index["kernel.all.cpu.user"];
    const posSys = this._index["kernel.all.cpu.sys"];
    if (posUser === undefined && posSys === undefined) return;

    for (const sample of samples) {
      // metrics1 diff-encodes samples after the first: unchanged values are
      // omitted (null/undefined). Flat-merge against the previous full sample.
      const merged = this._prevSample ? this._prevSample.slice() : [];
      if (Array.isArray(sample)) {
        sample.forEach((v, i) => { if (v !== null && v !== undefined) merged[i] = v; });
      }
      this._prevSample = merged;

      const user = Number(merged[posUser]) || 0;
      const sys = Number(merged[posSys]) || 0;
      // Exact units/normalization of kernel.all.cpu.{user,sys} rate over the
      // archive are unverified here; clamp defensively into a 0-100% band
      // rather than risk a nonsensical/huge value breaking the graph.
      const pct = Math.max(0, Math.min(100, user + sys));
      this._buf.push(pct);
    }
    if (this._buf.length) this.graph.render(this._buf.toArray());
    this.statusEl.textContent = "";
  }

  stop() {
    if (this.channel) {
      try { this.channel.close(); } catch (e) { /* ignore */ }
      this.channel = null;
    }
  }
}
