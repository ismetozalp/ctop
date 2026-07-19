// src/metrics.js
import { Decompressor } from "./decompress.js";
import { RingBuffer } from "./ringbuffer.js";

// Metric request list. derive:"rate" makes the bridge compute per-second deltas.
const METRICS = [
  { name: "cpu.basic.user",   derive: "rate" },
  { name: "cpu.basic.system", derive: "rate" },
  { name: "cpu.basic.nice",   derive: "rate" },
  { name: "cpu.core.user",    derive: "rate" },
  { name: "cpu.core.system",  derive: "rate" },
  { name: "cpu.core.nice",    derive: "rate" },
  { name: "cpu.temperature" },
  { name: "memory.used" },
  { name: "memory.cached" },
  // NOTE: the internal source does NOT support "memory.available" — requesting
  // it makes the whole channel fail with "not-supported". We derive available
  // as free+cached below (btop's fallback when MemAvailable is absent).
  { name: "memory.free" },
  { name: "memory.swap-used" },
  { name: "disk.dev.read",    units: "bytes", derive: "rate" },
  { name: "disk.dev.written", units: "bytes", derive: "rate" },
  { name: "network.interface.rx", units: "bytes", derive: "rate" },
  { name: "network.interface.tx", units: "bytes", derive: "rate" },
  { name: "mount.total" },
  { name: "mount.used" },
];

export class Metrics {
  constructor({ interval = 2000, historyLen = 600 } = {}) {
    this.interval = interval;
    this.historyLen = historyLen;
    this._dec = new Decompressor();
    this._meta = null;
    this._metaCbs = []; this._sampleCbs = [];
    this.cpu = { total: new RingBuffer(historyLen), cores: [], temp: new RingBuffer(historyLen), model: "" };
    this.mem = { used: 0, cached: 0, available: 0, free: 0, swapUsed: 0, swapTotal: 0, total: 0 };
    this.disks = {}; this.net = {}; this.mounts = {};
  }
  onmeta(fn) { this._metaCbs.push(fn); }
  onsample(fn) { this._sampleCbs.push(fn); }

  start() {
    this.channel = window.cockpit.channel({
      payload: "metrics1", source: "internal", interval: this.interval, metrics: METRICS,
    });
    this.channel.addEventListener("message", (_ev, payload) => this._onmessage(payload));
    this.channel.addEventListener("close", (_ev, options) => {
      this._closed = options && options.problem ? options.problem : "closed";
    });
    // CPU model name (btop shows it; the channel doesn't provide it). One-shot.
    window.cockpit.file("/proc/cpuinfo").read().then((c) => {
      if (!c) return;
      const m = c.match(/model name\s*:\s*(.+)/);
      // Trim marketing noise like btop does: "Intel(R) Core(TM) i7-7700HQ CPU @
      // 2.80GHz" -> "Intel Core i7-7700HQ".
      if (m) this.cpu.model = m[1].replace(/\(R\)|\(TM\)|\(tm\)/g, "").replace(/\s+CPU\s+@.*/i, "").replace(/\s+/g, " ").trim();
    }).catch(() => {});
    // /proc/meminfo has MemTotal, SwapTotal, and the kernel's MemAvailable —
    // none reliably in the channel — so poll it on the sample cadence.
    this._readMeminfo();
    this._meminfoTimer = setInterval(() => this._readMeminfo(), this.interval);
  }
  _readMeminfo() {
    if (this._meminfoInFlight) return;
    this._meminfoInFlight = true;
    window.cockpit.file("/proc/meminfo").read().then((c) => {
      this._meminfoInFlight = false;
      if (!c) return;
      const g = (re) => { const m = c.match(re); return m ? +m[1] * 1024 : null; };
      const total = g(/MemTotal:\s+(\d+)/);
      const swapTotal = g(/SwapTotal:\s+(\d+)/);
      const avail = g(/MemAvailable:\s+(\d+)/);
      if (total !== null) this.mem.total = total;
      if (swapTotal !== null) this.mem.swapTotal = swapTotal;
      if (avail !== null) this.mem.available = avail;
    }).catch(() => { this._meminfoInFlight = false; });
  }
  stop() { if (this.channel) this.channel.close(); if (this._meminfoTimer) clearInterval(this._meminfoTimer); }

  _onmessage(payload) {
    const data = JSON.parse(payload);
    if (!Array.isArray(data)) { this._onmeta(data); return; } // meta is an object
    for (const sample of this._dec.feed(data)) this._applySample(sample);
    this._sampleCbs.forEach((fn) => fn(this));
  }

  _onmeta(meta) {
    this._meta = meta;
    // Build an index: metric name (in request order) -> position, and capture instances.
    this._index = {};
    (meta.metrics || []).forEach((m, i) => { this._index[m.name] = { pos: i, instances: m.instances || null }; });
    const coreInst = (this._index["cpu.core.user"] || {}).instances || [];
    this.cpu.cores = coreInst.map(() => new RingBuffer(this.historyLen));
    const diskInst = (this._index["disk.dev.read"] || {}).instances || [];
    this._diskInst = diskInst;
    diskInst.forEach((d) => { this.disks[d] = { read: new RingBuffer(this.historyLen), write: new RingBuffer(this.historyLen) }; });
    const netInst = (this._index["network.interface.rx"] || {}).instances || [];
    this._netInst = netInst;
    netInst.forEach((n) => { this.net[n] = { rx: new RingBuffer(this.historyLen), tx: new RingBuffer(this.historyLen) }; });
    const mountInst = (this._index["mount.total"] || {}).instances || [];
    this._mountInst = mountInst;
    mountInst.forEach((p) => { this.mounts[p] = { total: 0, used: 0 }; });
    this._metaCbs.forEach((fn) => fn(meta));
  }

  _get(sample, name) { const e = this._index[name]; return e ? sample[e.pos] : undefined; }

  _applySample(sample) {
    // cpu.basic.* are counters in MILLISECONDS of CPU time; with derive:"rate"
    // the channel delivers ms/s. One fully-busy core = 1000 ms/s, so the
    // aggregate busy% = (user+system+nice) / (1000 * cores) * 100. (Verified
    // against the live metrics1 channel meta: units "millisec". The first rate
    // sample arrives as `false` -> coerces to 0 -> 0% for one frame.)
    const u = this._get(sample, "cpu.basic.user") || 0;
    const s = this._get(sample, "cpu.basic.system") || 0;
    const n = this._get(sample, "cpu.basic.nice") || 0;
    const cores = Math.max(1, this.cpu.cores.length);
    const totalPct = Math.min(100, (u + s + n) / (1000 * cores) * 100);
    this.cpu.total.push(totalPct);
    const cu = this._get(sample, "cpu.core.user") || [];
    const cs = this._get(sample, "cpu.core.system") || [];
    const cn = this._get(sample, "cpu.core.nice") || [];
    // per-core value is already per-core ms/s: fully busy = 1000 ms/s = 100%.
    this.cpu.cores.forEach((rb, i) => {
      rb.push(Math.min(100, ((cu[i] || 0) + (cs[i] || 0) + (cn[i] || 0)) / 1000 * 100));
    });
    // cpu.temperature is an array of per-sensor °C; use the hottest as the CPU
    // temp (the channel exposes sensor paths but no labels to pick the package).
    const temp = this._get(sample, "cpu.temperature");
    if (temp !== undefined && temp !== null && temp !== false)
      this.cpu.temp.push(Array.isArray(temp) ? Math.max(...temp) : temp);

    this.mem.used = this._get(sample, "memory.used") || 0;
    this.mem.cached = this._get(sample, "memory.cached") || 0;
    this.mem.free = this._get(sample, "memory.free") || 0;
    // this.mem.available comes from /proc/meminfo (MemAvailable) via _readMeminfo.
    this.mem.swapUsed = this._get(sample, "memory.swap-used") || 0;
    if (!this.mem.total) this.mem.total = this.mem.used + this.mem.available;

    const dr = this._get(sample, "disk.dev.read") || [];
    const dw = this._get(sample, "disk.dev.written") || [];
    (this._diskInst || []).forEach((d, i) => { this.disks[d].read.push(dr[i] || 0); this.disks[d].write.push(dw[i] || 0); });

    const rx = this._get(sample, "network.interface.rx") || [];
    const tx = this._get(sample, "network.interface.tx") || [];
    (this._netInst || []).forEach((nif, i) => { this.net[nif].rx.push(rx[i] || 0); this.net[nif].tx.push(tx[i] || 0); });

    const mt = this._get(sample, "mount.total") || [];
    const mu = this._get(sample, "mount.used") || [];
    (this._mountInst || []).forEach((p, i) => { this.mounts[p] = { total: mt[i] || 0, used: mu[i] || 0 }; });
  }
}
