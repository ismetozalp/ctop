function merge(prev, cur) {
  if (cur === null || cur === undefined) return clone(prev);
  if (Array.isArray(cur)) {
    const base = Array.isArray(prev) ? prev : [];
    return cur.map((v, i) => merge(base[i], v));
  }
  return cur;
}
function clone(v) { return Array.isArray(v) ? v.map(clone) : v; }

export class Decompressor {
  constructor() { this._prev = null; }
  feed(message) {
    const out = [];
    for (const sample of message) {
      const full = this._prev === null ? clone(sample) : merge(this._prev, sample);
      out.push(full);
      this._prev = full;
    }
    return out;
  }
}
